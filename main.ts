import { Editor, Menu, Notice, Plugin, TAbstractFile, TFile, Platform, FileSystemAdapter } from 'obsidian';
import { wrapPath, MarkdownLinkFormat } from './path-utils';
import { applyTemplate, TokenContext } from './token-engine';
import {
	SETTINGS_VERSION,
	CustomFormat,
	seedAllFormats,
	seedFormatsForVersion,
	normalizeCustomFormats,
} from './seed-utils';
import { resolveBlockTargetLine, findExistingBlockId, generateBlockId } from './block-utils';
import { pickRootFormats, matchesTarget } from './menu-utils';
import { ShellPathCopySettingTab } from './settings-tab';

// Node 'path' is only available on desktop. Load lazily behind a Platform.isDesktop
// guard so mobile builds do not pull in unavailable Node built-ins. The narrow
// return type avoids importing the @types/node `Path` namespace at the top level.
interface NodePathLike {
	join(...paths: string[]): string;
}
function getNodePath(): NodePathLike {
	if (!Platform.isDesktop) {
		throw new Error('Node path module is not available on this platform.');
	}
	// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-return, import/no-nodejs-modules -- Obsidian docs require a Platform.isDesktop-guarded require() for Node built-ins so mobile builds don't pull them in; the require, the any return, and the node-module import are unavoidable consequences of that guidance.
	return require('path');
}

interface PathCopySettings {
	showNotifications: boolean;
	markdownLinkFormat: MarkdownLinkFormat;
	warnOnUnresolvedTokens: boolean;
	useSubmenu: boolean;
	groupWithNativeCopyPath: boolean;
	customFormats: CustomFormat[];
	settingsVersion: number;
}

const DEFAULT_SETTINGS: PathCopySettings = {
	showNotifications: true,
	markdownLinkFormat: 'wiki-style',
	warnOnUnresolvedTokens: true,
	useSubmenu: true,
	groupWithNativeCopyPath: false,
	customFormats: [],
	settingsVersion: 0
}

// Obsidian's section id for items that render inside the native "Copy path"
// virtual submenu (alongside "as Obsidian URL", "from vault folder",
// "from system root"). The dotted name is a section-collapse convention:
// Obsidian groups every MenuItem sharing this section into one labeled
// submenu in the parent menu. Items added with this section render as
// children of the "Copy path" submenu using only public-API setSection.
// Verified empirically against Obsidian's file-menu items (Obsidian 1.6+);
// if a future release renames the section, items render in their own
// section instead of throwing.
//
const NATIVE_COPY_PATH_SECTION = 'info.copy';

// Token names that need a block id resolved (which may write into the note).
// A copy only touches the note when the template uses one of these.
const BLOCK_TOKEN_NAMES = ['block-id', 'obsidian-url-block', 'wikilink-block'];
function templateUsesBlockToken(template: string): boolean {
	return BLOCK_TOKEN_NAMES.some((name) => template.includes(`<${name}>`));
}

export default class ShellPathCopyPlugin extends Plugin {
	settings!: PathCopySettings;

	async onload() {
		await this.loadSettings();

		// File explorer right-click: act on the clicked file or folder.
		this.registerEvent(
			this.app.workspace.on('file-menu', (menu: Menu, file: TAbstractFile) => {
				this.addPathCopyMenuItems(menu, file);
			})
		);

		// In-document right-click: act on the open file, with the editor's
		// cursor supplying the heading and line context.
		this.registerEvent(
			this.app.workspace.on('editor-menu', (menu, editor, info) => {
				if (info.file) {
					this.addPathCopyMenuItems(menu, info.file, editor);
				}
			})
		);

		// Register command palette commands
		this.registerCommands();

		// Add a left-ribbon icon for each format opted into the ribbon
		this.registerRibbonIcons();

		// Add settings tab
		this.addSettingTab(new ShellPathCopySettingTab(this.app, this));
	}

	onunload() {
		// Cleanup is handled automatically by Obsidian for registered events
	}

	async loadSettings() {
		const raw = (await this.loadData()) as Record<string, unknown> | null;
		this.settings = { ...DEFAULT_SETTINGS };

		// Copy forward the settings that survive into 1.19.
		if (raw !== null) {
			if (typeof raw.showNotifications === 'boolean') {
				this.settings.showNotifications = raw.showNotifications;
			}
			if (raw.markdownLinkFormat === 'wiki-style' || raw.markdownLinkFormat === 'standard-markdown') {
				this.settings.markdownLinkFormat = raw.markdownLinkFormat;
			}
			if (typeof raw.warnOnUnresolvedTokens === 'boolean') {
				this.settings.warnOnUnresolvedTokens = raw.warnOnUnresolvedTokens;
			}
			if (typeof raw.useSubmenu === 'boolean') {
				this.settings.useSubmenu = raw.useSubmenu;
			}
			if (typeof raw.groupWithNativeCopyPath === 'boolean') {
				this.settings.groupWithNativeCopyPath = raw.groupWithNativeCopyPath;
			}
			if (typeof raw.settingsVersion === 'number') {
				this.settings.settingsVersion = raw.settingsVersion;
			}
			this.settings.customFormats = normalizeCustomFormats(raw.customFormats);
		}

		const fromVersion = this.settings.settingsVersion;
		if (fromVersion < SETTINGS_VERSION) {
			if (fromVersion < 1) {
				// Fresh install (raw null) or pre-1.19 upgrade (raw carries the
				// legacy booleans). Seed all built-ins; on an upgrade their enabled
				// state and wrapping are migrated from the old settings. Pre-1.19
				// users had no custom formats, so nothing is lost.
				this.settings.customFormats = seedAllFormats(raw);
			} else {
				// Incremental: append the seeds introduced in each newer version,
				// leaving the user's existing formats untouched.
				for (let v = fromVersion + 1; v <= SETTINGS_VERSION; v++) {
					this.settings.customFormats.push(...seedFormatsForVersion(v));
				}
			}
			this.settings.settingsVersion = SETTINGS_VERSION;
			await this.saveSettings();
		}
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	private registerCommands() {
		// One command per enabled custom format. Commands register once at
		// onload; adding, renaming, or toggling a format needs an Obsidian reload.
		for (const fmt of this.settings.customFormats) {
			if (!fmt.enabled || !fmt.showInCommands) {
				continue;
			}
			const formatId = fmt.id;
			const command = fmt;
			this.addCommand({
				id: `custom-format-${formatId}`,
				name: `Copy: ${fmt.name}`,
				// The palette only ever acts on the open note (a TFile), so the
				// folder context is always false here. A folders-only format, or
				// one whose tokens make it file-only, is hidden when it does not
				// apply; a missing active file also hides the command.
				checkCallback: (checking: boolean) => {
					const file = this.app.workspace.getActiveFile();
					if (!file || !matchesTarget(command, false)) {
						return false;
					}
					if (!checking) {
						void this.copyCustomFormat(formatId, file);
					}
					return true;
				}
			});
		}
	}

	private registerRibbonIcons() {
		// One ribbon icon per enabled format opted into the ribbon. Like commands,
		// these register once at onload; toggling needs an Obsidian reload.
		for (const fmt of this.settings.customFormats) {
			if (!fmt.enabled || !fmt.showInRibbon) {
				continue;
			}
			const formatId = fmt.id;
			const command = fmt;
			// The ribbon only ever acts on the open note (a TFile). A folders-only
			// format, or a missing active file, has nothing to act on, so warn
			// instead of copying.
			this.addRibbonIcon(fmt.icon, `Copy: ${fmt.name}`, () => {
				const file = this.app.workspace.getActiveFile();
				if (!file || !matchesTarget(command, false)) {
					new Notice('Open a note this format applies to first.');
					return;
				}
				void this.copyCustomFormat(formatId, file);
			});
		}
	}

	// Adds the enabled custom-format items to a context menu. `editor` is passed
	// from the in-document right-click so the cursor's heading and line resolve.
	// Three layouts, picked by settings:
	//   - groupWithNativeCopyPath on: assign each format the same section id
	//     ('info.copy') Obsidian uses for its native "as Obsidian URL" /
	//     "from vault folder" / "from system root" items. Obsidian collapses
	//     every item sharing that section into one virtual "Copy path"
	//     submenu, so the formats render as children of that submenu using
	//     only public-API setSection.
	//   - useSubmenu on (default): formats live inside a "Copy path as" submenu;
	//     formats with pinToRoot also appear at the menu root.
	//   - both off: every format appears flat at the menu root.
	// The menu is rebuilt on every right-click, so changes take effect without a
	// reload.
	private addPathCopyMenuItems(menu: Menu, file: TAbstractFile, editor?: Editor) {
		const isFolder = !(file instanceof TFile);
		const visible = this.settings.customFormats.filter(
			(fmt) => fmt.enabled && fmt.showInMenu && matchesTarget(fmt, isFolder));
		if (visible.length === 0) {
			return;
		}

		if (this.settings.groupWithNativeCopyPath) {
			for (const fmt of visible) {
				this.addFormatMenuItem(menu, fmt, file, editor, NATIVE_COPY_PATH_SECTION);
			}
			return;
		}

		menu.addSeparator();

		const useSubmenu = this.settings.useSubmenu;

		for (const fmt of pickRootFormats(visible, useSubmenu)) {
			this.addFormatMenuItem(menu, fmt, file, editor, 'shell-path-copy');
		}

		if (useSubmenu) {
			menu.addItem((parent) => {
				parent
					.setTitle('Copy path as')
					.setIcon('clipboard-copy')
					.setSection('shell-path-copy');
				const submenu = parent.setSubmenu();
				for (const fmt of visible) {
					this.addFormatMenuItem(submenu, fmt, file, editor, null);
				}
			});
		}
	}

	// Adds a single format as an item on the given menu. `section` chooses the
	// MenuItem.setSection target: a string assigns the named section (root-level
	// items group with other items in that section, separated by Obsidian's own
	// dividers); null omits setSection (used for submenu children, where the
	// submenu itself already does the grouping).
	private addFormatMenuItem(menu: Menu, fmt: CustomFormat, file: TAbstractFile, editor: Editor | undefined, section: string | null) {
		const formatId = fmt.id;
		menu.addItem((item) => {
			item
				.setTitle(fmt.name)
				.setIcon(fmt.icon)
				.onClick(async () => {
					await this.copyCustomFormat(formatId, file, editor);
				});
			if (section !== null) {
				item.setSection(section);
			}
		});
	}

	// Assembles the token context for a copy. All Obsidian API access for the
	// token engine happens here so the engine itself stays pure and testable.
	// `editor` is supplied by the in-document right-click; otherwise the active
	// editor is used when it is showing the file being copied. When
	// `ensureBlockId` is set and the cursor is on a block, a block id is read or
	// created (which writes into the note).
	private buildTokenContext(file: TAbstractFile, editor?: Editor, ensureBlockId = false): TokenContext {
		let absolutePath: string | null = null;
		if (!Platform.isMobile) {
			const adapter = this.app.vault.adapter;
			if (adapter instanceof FileSystemAdapter) {
				absolutePath = getNodePath().join(adapter.getBasePath(), file.path);
			}
		}

		// Resolve the editor showing this file: the one passed in (in-document
		// right-click), or the active editor when it is showing the same file.
		let sourceEditor: Editor | null = editor ?? null;
		if (!sourceEditor) {
			const activeEditor = this.app.workspace.activeEditor;
			if (activeEditor?.editor && activeEditor.file && activeEditor.file.path === file.path) {
				sourceEditor = activeEditor.editor;
			}
		}

		// The line number, heading, and block come from that editor's cursor.
		let lineNumber: number | null = null;
		let selectionStartLine: number | null = null;
		let selectionEndLine: number | null = null;
		let currentHeading: string | null = null;
		let blockId: string | null = null;
		if (sourceEditor && file instanceof TFile) {
			const cursorLine = sourceEditor.getCursor().line;
			lineNumber = cursorLine + 1;
			// Selection span. 'from'/'to' are normalized so 'from' precedes 'to'.
			// With no selection both equal the cursor. When a selection ends at
			// column 0 of a later line, the visible highlight stops on the line
			// above, so trim that trailing line off a multi-line selection.
			const from = sourceEditor.getCursor('from');
			const to = sourceEditor.getCursor('to');
			const endLine = to.ch === 0 && to.line > from.line ? to.line - 1 : to.line;
			selectionStartLine = from.line + 1;
			selectionEndLine = endLine + 1;
			// The cursor's heading is the last heading at or above the cursor.
			const headings = this.app.metadataCache.getFileCache(file)?.headings;
			if (headings) {
				for (const entry of headings) {
					if (entry.position.start.line <= cursorLine) {
						currentHeading = entry.heading;
					} else {
						break;
					}
				}
			}
			if (ensureBlockId) {
				blockId = this.resolveBlockId(file, sourceEditor, cursorLine);
			}
		}

		return {
			fileName: file.name,
			filePath: file.path,
			isFolder: !(file instanceof TFile),
			vaultName: this.app.vault.getName(),
			isWindows: Platform.isWin,
			absolutePath,
			lineNumber,
			selectionStartLine,
			selectionEndLine,
			currentHeading,
			blockId,
			markdownLinkFormat: this.settings.markdownLinkFormat,
			now: new Date()
		};
	}

	// Returns the block id for the block at the cursor, creating and writing one
	// into the note when the block has none. Returns null when the cursor is not
	// on a paragraph or list item (headings, tables, code blocks, etc. are not
	// supported and the caller falls back to a file link).
	private resolveBlockId(file: TFile, editor: Editor, cursorLine: number): string | null {
		const cache = this.app.metadataCache.getFileCache(file);
		const targetLine = resolveBlockTargetLine(
			cache?.sections ?? [],
			cache?.listItems ?? [],
			cursorLine
		);
		if (targetLine === null) {
			return null;
		}

		// Read the id from the block's line rather than trusting the cache, which
		// may be stale right after a previous insertion.
		const text = editor.getLine(targetLine);
		const existing = findExistingBlockId(text);
		if (existing) {
			return existing;
		}

		const id = generateBlockId(cache?.blocks ?? {});
		editor.setLine(targetLine, `${text} ^${id}`);
		return id;
	}

	async copyCustomFormat(formatId: string, file: TAbstractFile, editor?: Editor) {
		try {
			if (!navigator.clipboard) {
				throw new Error('Clipboard API not available.');
			}

			const fmt = this.settings.customFormats.find((f) => f.id === formatId);
			if (!fmt) {
				new Notice('Custom format not found. It may have been deleted.');
				return;
			}

			if (fmt.template.trim() === '') {
				new Notice('This custom format has an empty template.');
				return;
			}

			const applied = applyTemplate(
				fmt.template,
				this.buildTokenContext(file, editor, templateUsesBlockToken(fmt.template))
			);
			const result = wrapPath(applied.text, fmt.wrapping);

			await navigator.clipboard.writeText(result);

			// Surface tokens that could not resolve, if the user wants the warning.
			if (this.settings.warnOnUnresolvedTokens) {
				if (applied.usedDesktopTokenOnMobile) {
					new Notice('Absolute path / file URL tokens are unavailable here and were left blank.');
				} else if (applied.usedEditorTokenWithoutEditor) {
					new Notice('The line number was unavailable (file not open in the editor) and was left blank.');
				}
			}

			if (this.settings.showNotifications) {
				new Notice(`${fmt.name} copied!`);
			}
		} catch (error) {
			if (error instanceof Error && error.message.includes('Clipboard API')) {
				new Notice('Error: Clipboard API is not available in this environment.');
			} else {
				const detail = error instanceof Error ? error.message : String(error);
				console.error('Shell Path Copy: Failed to copy custom format:', error);
				new Notice(`Failed to copy custom format: ${detail}`);
			}
		}
	}

}

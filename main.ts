import { App, Editor, Menu, Notice, Plugin, PluginSettingTab, Setting, SettingPage, SettingDefinitionItem, TAbstractFile, TFile, TextAreaComponent, Platform, FileSystemAdapter, setIcon } from 'obsidian';
import { wrapPath, PathWrapping, MarkdownLinkFormat } from './path-utils';
import { applyTemplate, validateTemplate, listTokens, templateSupportsFolders, TokenContext } from './token-engine';
import {
	SETTINGS_VERSION,
	CustomFormat,
	generateFormatId,
	seedAllFormats,
	seedFormatsForVersion,
	normalizeCustomFormats,
} from './seed-utils';
import { resolveBlockTargetLine, findExistingBlockId, generateBlockId } from './block-utils';
import { pickRootFormats, matchesTarget } from './menu-utils';
import { SelectIconModal } from './select-icon-modal';

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

// Curated set of menu-relevant icons offered in the per-format icon picker.
const ICON_CHOICES: string[] = [
	'clipboard-copy', 'clipboard', 'copy', 'file', 'file-text', 'file-code',
	'files', 'folder', 'folder-closed', 'link', 'link-2', 'globe', 'terminal',
	'hash', 'book', 'bookmark', 'external-link', 'list'
];

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

const RELOAD_NOTICE = 'Please reload Obsidian for command palette and ribbon changes to take effect';

class ShellPathCopySettingTab extends PluginSettingTab {
	plugin: ShellPathCopyPlugin;

	constructor(app: App, plugin: ShellPathCopyPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	getSettingDefinitions(): SettingDefinitionItem[] {
		return [
			{
				name: 'Show notifications',
				desc: 'Display a notification when something is copied',
				control: { type: 'toggle', key: 'showNotifications' }
			},
			{
				name: 'Markdown link format',
				desc: 'Format used by the <markdown-link> token',
				control: {
					type: 'dropdown',
					key: 'markdownLinkFormat',
					options: {
						'wiki-style': 'Wiki-style - [[filename]]',
						'standard-markdown': 'Standard Markdown - [filename](path)'
					}
				}
			},
			{
				name: 'Notify when a token could not be resolved',
				desc: 'Show a notice when a desktop-only or editor-only token is left blank',
				control: { type: 'toggle', key: 'warnOnUnresolvedTokens' }
			},
			{
				name: 'Group formats under a submenu',
				desc: 'Nest every format inside one right-click submenu. Pin individual formats below to also show them at the root menu. Ignored when "group with Obsidian\'s copy path" is on.',
				control: {
					type: 'toggle',
					key: 'useSubmenu',
					disabled: () => this.plugin.settings.groupWithNativeCopyPath
				}
			},
			{
				name: "Group with Obsidian's copy path",
				desc: "Place every enabled format inside Obsidian's native copy path submenu, alongside built-in entries like 'as Obsidian URL' and 'from vault folder'. The plugin's own 'copy path as' submenu is hidden when this is on.",
				control: { type: 'toggle', key: 'groupWithNativeCopyPath' }
			},
			{
				type: 'list',
				heading: 'Custom formats',
				emptyState: 'No custom formats yet. Add one to create a copy action.',
				onReorder: (oldIndex: number, newIndex: number) => {
					this.moveFormat(oldIndex, newIndex);
					void this.plugin.saveSettings();
					new Notice(RELOAD_NOTICE);
					this.update();
				},
				onDelete: (index: number) => {
					this.plugin.settings.customFormats.splice(index, 1);
					void this.plugin.saveSettings();
					new Notice(RELOAD_NOTICE);
					this.update();
				},
				addItem: {
					name: 'Add custom format',
					action: () => {
						const created: CustomFormat = {
							id: generateFormatId(),
							name: 'New format',
							template: '',
							wrapping: 'none',
							icon: 'clipboard-copy',
							enabled: true,
							showInMenu: true,
							showInCommands: true,
							showInRibbon: false,
							pinToRoot: false,
							appliesTo: 'both'
						};
						this.plugin.settings.customFormats.push(created);
						void this.plugin.saveSettings();
						new Notice(RELOAD_NOTICE);
						this.update();
					}
				},
				items: this.plugin.settings.customFormats.map((fmt) => ({
					type: 'page' as const,
					name: fmt.name || 'Untitled format',
					desc: fmt.enabled
						? (fmt.template || '(empty template)')
						: `(disabled) ${fmt.template || '(empty template)'}`,
					page: () => new FormatEditorPage(this, fmt)
				}))
			},
			{
				name: '',
				searchable: false,
				render: (setting: Setting) => { this.renderFooter(setting); }
			}
		];
	}

	// Binds declarative control definitions to the plugin's own settings store,
	// so a change persists through saveSettings() and stays consistent with the
	// live settings the menu, command palette, and ribbon read.
	getControlValue(key: string): unknown {
		return (this.plugin.settings as unknown as Record<string, unknown>)[key];
	}

	async setControlValue(key: string, value: unknown): Promise<void> {
		(this.plugin.settings as unknown as Record<string, unknown>)[key] = value;
		await this.plugin.saveSettings();
		// Re-evaluate disabled predicates in place (the submenu toggle greys out
		// when "group with Obsidian's copy path" is on).
		this.refreshDomState();
	}

	// Renders the version + links footer into a trailing settings row.
	private renderFooter(setting: Setting): void {
		const el = setting.settingEl;
		el.empty();
		el.addClass('shell-path-copy-footer');

		const manifestVersion = this.plugin.manifest.version || '1.0.0';
		el.createSpan({ text: `Version ${manifestVersion} | ` });

		const createExternalLink = (text: string, url: string) => {
			return el.createEl('a', {
				text: text,
				href: url,
				attr: { target: '_blank', rel: 'noopener' }
			});
		};

		createExternalLink('GitHub', 'https://github.com/ckelsoe/obsidian-shell-path-copy');
		el.createSpan({ text: ' | ' });
		createExternalLink('Report Issues', 'https://github.com/ckelsoe/obsidian-shell-path-copy/issues');
	}

	// Moves a format within the list (drag-drop reorder).
	private moveFormat(from: number, to: number): void {
		const list = this.plugin.settings.customFormats;
		if (from < 0 || to < 0 || from >= list.length || to >= list.length) {
			return;
		}
		const [moved] = list.splice(from, 1);
		list.splice(to, 0, moved);
	}

}

// A navigable settings sub-page for editing one custom format. SettingPage.display()
// (unlike the deprecated PluginSettingTab.display()) is the supported way to render an
// imperative sub-page; Obsidian opens this when the user taps a format in the
// declarative custom-formats list.
class FormatEditorPage extends SettingPage {
	private tab: ShellPathCopySettingTab;
	private fmt: CustomFormat;

	constructor(tab: ShellPathCopySettingTab, fmt: CustomFormat) {
		super();
		this.tab = tab;
		this.fmt = fmt;
		this.title = fmt.name || 'Untitled format';
	}

	private get plugin(): ShellPathCopyPlugin {
		return this.tab.plugin;
	}

	display(): void {
		const fmt = this.fmt;
		const editor = this.containerEl;
		editor.empty();
		let previewEl: HTMLElement;
		let infoEl: HTMLElement;

		new Setting(editor)
			.setName('Enabled')
			.setDesc('Turn this format on or off everywhere (menu, command palette, ribbon)')
			.addToggle(toggle => toggle
				.setValue(fmt.enabled)
				.onChange(async (value) => {
					fmt.enabled = value;
					await this.plugin.saveSettings();
					new Notice(RELOAD_NOTICE);
				}));

		new Setting(editor)
			.setName('Name')
			.addText(text => text
				.setValue(fmt.name)
				.onChange(async (value) => {
					fmt.name = value;
					// Keep the page title in sync; the list entry relabels on the
					// next tab render (when the user navigates back).
					this.title = value || 'Untitled format';
					await this.plugin.saveSettings();
				}));

		new Setting(editor)
			.setName('Icon')
			.setDesc('Icon shown next to this format in the menu, command palette, and ribbon. Pick a common one or browse the full set.')
			.addDropdown(dropdown => {
				for (const icon of ICON_CHOICES) {
					dropdown.addOption(icon, icon);
				}
				dropdown.setValue(ICON_CHOICES.includes(fmt.icon) ? fmt.icon : 'clipboard-copy');
				dropdown.onChange(async (value) => {
					fmt.icon = value;
					await this.plugin.saveSettings();
				});
			})
			.addButton(button => button
				.setButtonText('Browse all icons')
				.onClick(() => {
					new SelectIconModal(this.tab.app, fmt.icon, (chosen) => {
						fmt.icon = chosen;
						void this.plugin.saveSettings();
						// Rebuild so the dropdown reflects the new icon (or shows the
						// curated default when the chosen icon is outside ICON_CHOICES).
						this.display();
					}).open();
				}));

		// Refreshes the "Show on" control in place. Assigned where the control is
		// built below; invoked when the template changes so the files/folders choice
		// tracks whether the current template still supports folders.
		let refreshShowOn = (): void => {};

		let templateRef: TextAreaComponent;
		new Setting(editor)
			.setName('Template')
			.setDesc('Use tokens like <filename>. Click a token below to insert it at the cursor.')
			.addTextArea(text => {
				templateRef = text;
				text.setValue(fmt.template)
					.setPlaceholder('<filename> -> <obsidian-url>')
					.onChange(async (value) => {
						fmt.template = value;
						this.renderPreview(previewEl, infoEl, value);
						refreshShowOn();
						await this.plugin.saveSettings();
					});
				text.inputEl.addClass('shell-path-copy-template-input');
			});

		// Token palette: clicking a token inserts <token> at the cursor.
		const palette = editor.createDiv({ cls: 'shell-path-copy-token-palette' });
		for (const token of listTokens()) {
			const tip = token.tier === 'desktop'
				? ' (desktop only)'
				: token.tier === 'editor' ? ' (editor only)' : '';
			const button = palette.createEl('button', {
				cls: 'shell-path-copy-token-button',
				text: `<${token.name}>`,
				attr: { title: `${token.description}${tip}` }
			});
			button.addEventListener('click', () => {
				const input = templateRef.inputEl;
				const insert = `<${token.name}>`;
				const start = input.selectionStart;
				const end = input.selectionEnd;
				const next = input.value.slice(0, start) + insert + input.value.slice(end);
				templateRef.setValue(next);
				fmt.template = next;
				this.renderPreview(previewEl, infoEl, next);
				refreshShowOn();
				void this.plugin.saveSettings();
				input.focus();
				const caret = start + insert.length;
				input.setSelectionRange(caret, caret);
			});
		}

		previewEl = editor.createDiv({ cls: 'shell-path-copy-template-preview' });
		infoEl = editor.createDiv({ cls: 'shell-path-copy-format-info' });
		this.renderPreview(previewEl, infoEl, fmt.template);

		new Setting(editor)
			.setName('Wrapping')
			.setDesc('Wrap the rendered result (useful for paths with spaces)')
			.addDropdown(dropdown => dropdown
				.addOption('none', 'None')
				.addOption('double-quotes', 'Double quotes')
				.addOption('single-quotes', 'Single quotes')
				.addOption('backticks', 'Backticks')
				.setValue(fmt.wrapping)
				.onChange(async (value) => {
					fmt.wrapping = value as PathWrapping;
					this.renderPreview(previewEl, infoEl, fmt.template);
					await this.plugin.saveSettings();
				}));

		new Setting(editor)
			.setName('Show in menu')
			.setDesc('Display this format in the file explorer right-click menu')
			.addToggle(toggle => toggle
				.setValue(fmt.showInMenu)
				.onChange(async (value) => {
					fmt.showInMenu = value;
					await this.plugin.saveSettings();
					// Rebuild so the pin toggle below updates its disabled state.
					this.display();
				}));

		new Setting(editor)
			.setName('Pin to root menu')
			.setDesc('Also show this format at the top of the right-click menu, not only inside the submenu.')
			.addToggle(toggle => toggle
				.setValue(fmt.pinToRoot)
				.setDisabled(!fmt.showInMenu)
				.onChange(async (value) => {
					fmt.pinToRoot = value;
					await this.plugin.saveSettings();
				}));

		// "Show on" preference. A folder-safe template (only path/name tokens) gets
		// the full files/folders/both choice. A template using file-only tokens
		// (obsidian-url, wikilinks, editor tokens) cannot apply to folders, so the
		// dropdown is locked to "Files only" and disabled, with the reason in the
		// description. The stored appliesTo is left untouched so the preference
		// returns if the template is later edited back to folder-safe.
		const showOnContainer = editor.createDiv();
		refreshShowOn = () => {
			showOnContainer.empty();
			const showOn = new Setting(showOnContainer).setName('Show on');
			if (templateSupportsFolders(fmt.template)) {
				showOn
					.setDesc('Limit this format to files, folders, or show it on both.')
					.addDropdown(dropdown => dropdown
						.addOption('both', 'Files and folders')
						.addOption('files', 'Files only')
						.addOption('folders', 'Folders only')
						.setValue(fmt.appliesTo)
						.onChange(async (value) => {
							fmt.appliesTo = value as CustomFormat['appliesTo'];
							await this.plugin.saveSettings();
						}));
			} else {
				showOn
					.setDesc('Files only. This format uses file-specific tokens (like <obsidian-url>) that do not apply to folders.')
					.addDropdown(dropdown => dropdown
						.addOption('files', 'Files only')
						.setValue('files')
						.setDisabled(true));
			}
		};
		refreshShowOn();

		new Setting(editor)
			.setName('Show in command palette')
			.setDesc('Register this format as a command')
			.addToggle(toggle => toggle
				.setValue(fmt.showInCommands)
				.onChange(async (value) => {
					fmt.showInCommands = value;
					await this.plugin.saveSettings();
					new Notice(RELOAD_NOTICE);
				}));

		new Setting(editor)
			.setName('Show in ribbon')
			.setDesc('Add a left-ribbon icon that copies this format')
			.addToggle(toggle => toggle
				.setValue(fmt.showInRibbon)
				.onChange(async (value) => {
					fmt.showInRibbon = value;
					await this.plugin.saveSettings();
					new Notice(RELOAD_NOTICE);
				}));
	}

	// A fixed sample file used to render the live template preview. Reflects the
	// host platform so the preview matches what the user will actually get.
	private sampleContext(): TokenContext {
		const isWindows = Platform.isWin;
		return {
			fileName: 'My file.md',
			filePath: 'Notes/My file.md',
			isFolder: false,
			vaultName: 'assorted',
			isWindows,
			absolutePath: Platform.isMobile
				? null
				: (isWindows
					? 'C:\\Users\\name\\assorted\\Notes\\My file.md'
					: '/home/name/assorted/Notes/My file.md'),
			lineNumber: 42,
			selectionStartLine: 42,
			selectionEndLine: 58,
			currentHeading: 'My heading',
			blockId: 'a1b2c3',
			markdownLinkFormat: this.plugin.settings.markdownLinkFormat,
			now: new Date()
		};
	}

	// Renders one Desktop/Mobile support row item with a check or cross icon.
	private renderCompatItem(parent: HTMLElement, label: string, ok: boolean): void {
		const item = parent.createSpan({ cls: 'shell-path-copy-compat-item' });
		const mark = item.createSpan({
			cls: ok ? 'shell-path-copy-compat-ok' : 'shell-path-copy-compat-bad'
		});
		setIcon(mark, ok ? 'check' : 'x');
		item.createSpan({ text: label });
	}

	// Renders the live preview line, the Desktop/Mobile support row, and any
	// notes about tokens that will not resolve everywhere.
	private renderPreview(previewEl: HTMLElement, infoEl: HTMLElement, template: string): void {
		previewEl.empty();
		infoEl.empty();

		if (template.trim() === '') {
			previewEl.setText('Preview: (empty template)');
			return;
		}

		const applied = applyTemplate(template, this.sampleContext());
		previewEl.setText(`Preview: ${applied.text}`);

		const issues = validateTemplate(template);
		const desktopOnly = issues.filter((i) => i.kind === 'desktop-only-token');
		const editorOnly = issues.filter((i) => i.kind === 'editor-only-token');
		const unknown = issues.filter((i) => i.kind === 'unknown-token');

		// Desktop/Mobile support. Everything works on desktop; mobile fails only
		// when the template uses a desktop-only token.
		const compat = infoEl.createDiv({ cls: 'shell-path-copy-compat' });
		this.renderCompatItem(compat, 'Desktop', true);
		this.renderCompatItem(compat, 'Mobile', desktopOnly.length === 0);

		for (const issue of desktopOnly) {
			infoEl.createDiv({ cls: 'shell-path-copy-info-note', text: issue.detail });
		}
		if (editorOnly.length > 0) {
			infoEl.createDiv({
				cls: 'shell-path-copy-info-note',
				text: 'The line number fills in only when this file is open in the editor.'
			});
		}
		for (const issue of unknown) {
			infoEl.createDiv({ cls: 'shell-path-copy-badge-warn', text: issue.detail });
		}
	}
}

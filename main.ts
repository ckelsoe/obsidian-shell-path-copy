import { App, Editor, Menu, Notice, Plugin, PluginSettingTab, Setting, TAbstractFile, TFile, TextAreaComponent, Platform, FileSystemAdapter, setIcon } from 'obsidian';
import { wrapPath, PathWrapping, MarkdownLinkFormat } from './path-utils';
import { applyTemplate, validateTemplate, listTokens, TokenContext } from './token-engine';

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

// Settings schema version. Bumped when a one-time migration is needed.
//   1: token engine; built-ins seeded as custom formats.
//   2: heading-aware link seeds added.
//   3: block-aware link seeds added.
const SETTINGS_VERSION = 3;

// A user-defined copy format. Each entry produces its own context-menu item and
// command-palette command via the token engine. The 8 built-ins ship as seeded
// CustomFormat entries; there is no separate built-in code path.
interface CustomFormat {
	id: string;            // stable unique id, used for command ids
	name: string;
	template: string;
	wrapping: PathWrapping; // applied around the rendered result
	icon: string;          // Lucide icon name shown in the menu
	enabled: boolean;
	showInMenu: boolean;
	showInCommands: boolean;
}

interface PathCopySettings {
	showNotifications: boolean;
	markdownLinkFormat: MarkdownLinkFormat;
	warnOnUnresolvedTokens: boolean;
	customFormats: CustomFormat[];
	settingsVersion: number;
}

const DEFAULT_SETTINGS: PathCopySettings = {
	showNotifications: true,
	markdownLinkFormat: 'wiki-style',
	warnOnUnresolvedTokens: true,
	customFormats: [],
	settingsVersion: 0
}

const VALID_WRAPPINGS: PathWrapping[] = ['none', 'double-quotes', 'single-quotes', 'backticks'];

// Curated set of menu-relevant icons offered in the per-format icon picker.
const ICON_CHOICES: string[] = [
	'clipboard-copy', 'clipboard', 'copy', 'file', 'file-text', 'file-code',
	'files', 'folder', 'folder-closed', 'link', 'link-2', 'globe', 'terminal',
	'hash', 'book', 'bookmark', 'external-link', 'list'
];

// Specification for a seeded built-in format. `legacyKey` maps to the pre-1.19
// boolean setting (or 'unix'/'windows' for the menuDisplay-governed paths) so
// migration can carry the user's prior choices forward.
interface SeedSpec {
	name: string;
	template: string;
	icon: string;
	wrapMode: 'path' | 'filename' | 'plain';
	core: boolean;        // enabled by default on a fresh install
	legacyKey: string;
	sinceVersion: number; // settings version that introduced this seed
}

const BUILTIN_SEEDS: SeedSpec[] = [
	{ name: 'Relative Linux/macOS path', template: '<relative-path-unix>', icon: 'terminal', wrapMode: 'path', core: true, legacyKey: 'unix', sinceVersion: 1 },
	{ name: 'Relative Windows path', template: '<relative-path-windows>', icon: 'folder-closed', wrapMode: 'path', core: true, legacyKey: 'windows', sinceVersion: 1 },
	{ name: 'Absolute path', template: '<absolute-path>', icon: 'folder-closed', wrapMode: 'path', core: false, legacyKey: 'showAbsolutePath', sinceVersion: 1 },
	{ name: 'file:// URL', template: '<file-url>', icon: 'globe', wrapMode: 'plain', core: false, legacyKey: 'showFileUrl', sinceVersion: 1 },
	{ name: 'Obsidian URL', template: '<obsidian-url>', icon: 'link-2', wrapMode: 'plain', core: true, legacyKey: 'showObsidianUrl', sinceVersion: 1 },
	{ name: 'Markdown link', template: '<markdown-link>', icon: 'link', wrapMode: 'plain', core: true, legacyKey: 'showMarkdownLink', sinceVersion: 1 },
	{ name: 'Filename', template: '<filename>', icon: 'file-text', wrapMode: 'filename', core: false, legacyKey: 'showFilename', sinceVersion: 1 },
	{ name: 'Filename with extension', template: '<filename-ext>', icon: 'file', wrapMode: 'filename', core: false, legacyKey: 'showFilenameWithExt', sinceVersion: 1 },
	// Example formats from issue 13. Seeded disabled as starting points.
	{ name: 'Example: name and Obsidian URL', template: '<filename> -> <obsidian-url>', icon: 'link-2', wrapMode: 'plain', core: false, legacyKey: '', sinceVersion: 1 },
	{ name: 'Example: line reference', template: '<filename-ext>#L<line-number>', icon: 'hash', wrapMode: 'plain', core: false, legacyKey: '', sinceVersion: 1 },
	// Heading-aware links: jump to the cursor's heading, or the file if none.
	{ name: 'Obsidian URL (to heading)', template: '<obsidian-url-section>', icon: 'link-2', wrapMode: 'plain', core: false, legacyKey: '', sinceVersion: 2 },
	{ name: 'Wiki link (to heading)', template: '<wikilink-section>', icon: 'hash', wrapMode: 'plain', core: false, legacyKey: '', sinceVersion: 2 },
	// Block-aware links: jump to the cursor's block, creating a block id if needed.
	{ name: 'Obsidian URL (to block)', template: '<obsidian-url-block>', icon: 'link-2', wrapMode: 'plain', core: false, legacyKey: '', sinceVersion: 3 },
	{ name: 'Wiki link (to block)', template: '<wikilink-block>', icon: 'hash', wrapMode: 'plain', core: false, legacyKey: '', sinceVersion: 3 }
];

// Token names that need a block id resolved (which may write into the note).
// A copy only touches the note when the template uses one of these.
const BLOCK_TOKEN_NAMES = ['block-id', 'obsidian-url-block', 'wikilink-block'];
function templateUsesBlockToken(template: string): boolean {
	return BLOCK_TOKEN_NAMES.some((name) => template.includes(`<${name}>`));
}

// Generates a stable id for a custom format. Prefers crypto.randomUUID (available
// in Obsidian's Electron and modern mobile runtimes); falls back to a timestamp +
// random suffix where it is not.
function generateFormatId(): string {
	if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
		return crypto.randomUUID();
	}
	return `fmt-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e9).toString(36)}`;
}

// Builds one CustomFormat from a seed spec. With no legacy data (fresh install)
// the core set is enabled with default wrapping. With legacy data, enabled state
// and wrapping are migrated from the pre-1.19 boolean settings so existing users
// keep exactly what they had.
function makeSeed(spec: SeedSpec, legacy: Record<string, unknown> | null): CustomFormat {
	const oldWrap: PathWrapping = legacy && VALID_WRAPPINGS.includes(legacy.pathWrapping as PathWrapping)
		? (legacy.pathWrapping as PathWrapping)
		: 'backticks';
	const menuDisplay = legacy ? legacy.menuDisplay : undefined;
	const filenameWrap = legacy ? legacy.filenameUseWrapping === true : false;

	let enabled: boolean;
	if (!legacy || spec.legacyKey === '') {
		// Fresh install, or a seed with no pre-1.19 equivalent.
		enabled = spec.core;
	} else if (spec.legacyKey === 'unix') {
		enabled = menuDisplay !== 'windows';
	} else if (spec.legacyKey === 'windows') {
		enabled = menuDisplay !== 'linux-mac';
	} else {
		// Pre-1.19 show* booleans defaulted to true; absent counts as enabled.
		enabled = legacy[spec.legacyKey] !== false;
	}

	let wrapping: PathWrapping = 'none';
	if (spec.wrapMode === 'path') {
		wrapping = legacy ? oldWrap : 'backticks';
	} else if (spec.wrapMode === 'filename') {
		wrapping = legacy && filenameWrap ? oldWrap : 'none';
	}

	return {
		id: generateFormatId(),
		name: spec.name,
		template: spec.template,
		wrapping,
		icon: spec.icon,
		enabled,
		showInMenu: true,
		showInCommands: true
	};
}

// All seeded formats, for a fresh install or a pre-1.19 upgrade.
function seedAllFormats(legacy: Record<string, unknown> | null): CustomFormat[] {
	return BUILTIN_SEEDS.map((spec) => makeSeed(spec, legacy));
}

// Seeds introduced in a specific settings version, for incremental migration.
// These are always new (no legacy mapping), so they use fresh-install defaults.
function seedFormatsForVersion(version: number): CustomFormat[] {
	return BUILTIN_SEEDS.filter((spec) => spec.sinceVersion === version).map((spec) => makeSeed(spec, null));
}

// Coerces possibly-corrupt or hand-edited persisted data into a valid CustomFormat
// array. Anything missing falls back to a safe default.
function normalizeCustomFormats(value: unknown): CustomFormat[] {
	if (!Array.isArray(value)) {
		return [];
	}
	return value.map((raw): CustomFormat => {
		const item = (raw ?? {}) as Partial<CustomFormat>;
		const wrapping = VALID_WRAPPINGS.includes(item.wrapping as PathWrapping)
			? (item.wrapping as PathWrapping)
			: 'none';
		return {
			id: typeof item.id === 'string' && item.id ? item.id : generateFormatId(),
			name: typeof item.name === 'string' ? item.name : 'Custom format',
			template: typeof item.template === 'string' ? item.template : '',
			wrapping,
			icon: typeof item.icon === 'string' && item.icon ? item.icon : 'clipboard-copy',
			enabled: item.enabled !== false,
			showInMenu: item.showInMenu !== false,
			showInCommands: item.showInCommands !== false
		};
	});
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
			this.addCommand({
				id: `custom-format-${formatId}`,
				name: `Copy: ${fmt.name}`,
				callback: () => {
					const file = this.getActiveOrFocusedFile();
					if (file) {
						void this.copyCustomFormat(formatId, file);
					}
				}
			});
		}
	}

	// Adds the enabled custom-format items to a context menu. `editor` is passed
	// from the in-document right-click so the cursor's heading and line resolve.
	private addPathCopyMenuItems(menu: Menu, file: TAbstractFile, editor?: Editor) {
		const visible = this.settings.customFormats.filter((fmt) => fmt.enabled && fmt.showInMenu);
		if (visible.length === 0) {
			return;
		}

		menu.addSeparator();

		// The menu is rebuilt on every right-click, so menu changes take effect
		// without a reload.
		for (const fmt of visible) {
			const formatId = fmt.id;
			menu.addItem((item) => {
				item
					.setTitle(fmt.name)
					.setIcon(fmt.icon)
					.setSection('shell-path-copy')
					.onClick(async () => {
						await this.copyCustomFormat(formatId, file, editor);
					});
			});
		}
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
		let currentHeading: string | null = null;
		let blockId: string | null = null;
		if (sourceEditor && file instanceof TFile) {
			const cursorLine = sourceEditor.getCursor().line;
			lineNumber = cursorLine + 1;
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
			currentHeading,
			blockId,
			markdownLinkFormat: this.settings.markdownLinkFormat,
			now: new Date()
		};
	}

	// Returns the block id for the block at the cursor, creating and writing one
	// into the note when the block has none. Returns null for headings, frontmatter,
	// or when no block contains the cursor.
	private resolveBlockId(file: TFile, editor: Editor, cursorLine: number): string | null {
		const sections = this.app.metadataCache.getFileCache(file)?.sections;
		if (!sections) {
			return null;
		}
		const section = sections.find(
			(s) => s.position.start.line <= cursorLine && cursorLine <= s.position.end.line
		);
		if (!section || section.type === 'heading' || section.type === 'yaml') {
			return null;
		}

		// Read the id from the block's last line rather than trusting the cache,
		// which may be stale right after a previous insertion.
		const lastLine = section.position.end.line;
		const text = editor.getLine(lastLine);
		const existing = text.match(/[ \t]\^([a-zA-Z0-9-]+)\s*$/);
		if (existing) {
			return existing[1];
		}

		// Generate a fresh id not already used elsewhere in the note.
		const used = this.app.metadataCache.getFileCache(file)?.blocks ?? {};
		let id = '';
		do {
			id = Math.random().toString(36).slice(2, 8);
		} while (used[id]);

		editor.setLine(lastLine, `${text} ^${id}`);
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
				console.error('Shell Path Copy: Failed to copy custom format:', error);
				new Notice('Failed to copy custom format. See console for details.');
			}
		}
	}

	private getActiveOrFocusedFile(): TAbstractFile | null {
		const file = this.app.workspace.getActiveFile();

		if (!file) {
			new Notice('No file selected. Open a file or right-click it in the file explorer.');
		}

		return file;
	}

}

const RELOAD_NOTICE = 'Please reload Obsidian for command palette changes to take effect';

class ShellPathCopySettingTab extends PluginSettingTab {
	plugin: ShellPathCopyPlugin;
	// Id of the format whose editor is currently expanded, or null.
	private expandedId: string | null = null;
	// Index of the row being dragged during a reorder, or null.
	private dragIndex: number | null = null;

	constructor(app: App, plugin: ShellPathCopyPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName('Show notifications')
			.setDesc('Display a notification when something is copied')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.showNotifications)
				.onChange(async (value) => {
					this.plugin.settings.showNotifications = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Markdown link format')
			.setDesc('Format used by the <markdown-link> token')
			.addDropdown(dropdown => dropdown
				.addOption('wiki-style', 'Wiki-style - [[filename]]')
				.addOption('standard-markdown', 'Standard Markdown - [filename](path)')
				.setValue(this.plugin.settings.markdownLinkFormat)
				.onChange(async (value) => {
					this.plugin.settings.markdownLinkFormat = value as MarkdownLinkFormat;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Notify when a token could not be resolved')
			.setDesc('Show a notice when a desktop-only or editor-only token is left blank')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.warnOnUnresolvedTokens)
				.onChange(async (value) => {
					this.plugin.settings.warnOnUnresolvedTokens = value;
					await this.plugin.saveSettings();
				}));

		this.renderCustomFormatsSection(containerEl);

		// Support links at the bottom
		containerEl.createEl('br');
		containerEl.createEl('br');

		const footerDiv = containerEl.createDiv({
			cls: 'setting-item-description shell-path-copy-footer'
		});

		const manifestVersion = this.plugin.manifest.version || '1.0.0';
		footerDiv.createSpan({ text: `Version ${manifestVersion} | ` });

		const createExternalLink = (text: string, url: string) => {
			return footerDiv.createEl('a', {
				text: text,
				href: url,
				attr: { target: '_blank', rel: 'noopener' }
			});
		};

		createExternalLink('GitHub', 'https://github.com/ckelsoe/obsidian-shell-path-copy');
		footerDiv.createSpan({ text: ' | ' });
		createExternalLink('Report Issues', 'https://github.com/ckelsoe/obsidian-shell-path-copy/issues');
	}

	// Renders the "Custom formats" section: a compact draggable list, with the
	// one expanded format showing its full editor.
	private renderCustomFormatsSection(containerEl: HTMLElement): void {
		new Setting(containerEl).setName('Custom formats').setHeading();

		containerEl.createDiv({
			cls: 'setting-item-description',
			text: 'Each format is a token template that becomes a context-menu item and a command. Drag to reorder; the order is the menu order.'
		});

		const listEl = containerEl.createDiv({ cls: 'shell-path-copy-format-list' });
		this.plugin.settings.customFormats.forEach((fmt, index) => {
			this.renderFormatRow(listEl, fmt, index);
		});

		new Setting(containerEl)
			.addButton(button => button
				.setButtonText('Add custom format')
				.setCta()
				.onClick(async () => {
					const created: CustomFormat = {
						id: generateFormatId(),
						name: 'New format',
						template: '',
						wrapping: 'none',
						icon: 'clipboard-copy',
						enabled: true,
						showInMenu: true,
						showInCommands: true
					};
					this.plugin.settings.customFormats.push(created);
					this.expandedId = created.id;
					await this.plugin.saveSettings();
					new Notice(RELOAD_NOTICE);
					this.display();
				}));
	}

	// Renders one compact list row, plus the full editor panel when expanded.
	private renderFormatRow(listEl: HTMLElement, fmt: CustomFormat, index: number): void {
		const expanded = this.expandedId === fmt.id;

		const row = listEl.createDiv({ cls: 'shell-path-copy-format-row' });
		row.draggable = true;

		row.addEventListener('dragstart', () => {
			this.dragIndex = index;
			row.addClass('is-dragging');
		});
		row.addEventListener('dragend', () => {
			this.dragIndex = null;
			row.removeClass('is-dragging');
		});
		row.addEventListener('dragover', (event) => {
			event.preventDefault();
			row.addClass('is-dragover');
		});
		row.addEventListener('dragleave', () => {
			row.removeClass('is-dragover');
		});
		row.addEventListener('drop', (event) => {
			event.preventDefault();
			row.removeClass('is-dragover');
			if (this.dragIndex !== null && this.dragIndex !== index) {
				this.moveFormat(this.dragIndex, index);
				void this.plugin.saveSettings();
				new Notice(RELOAD_NOTICE);
				this.display();
			}
		});

		const handle = row.createSpan({ cls: 'shell-path-copy-drag-handle' });
		setIcon(handle, 'grip-vertical');

		const iconEl = row.createSpan({ cls: 'shell-path-copy-format-icon' });
		setIcon(iconEl, fmt.icon);

		const nameSpan = row.createSpan({ cls: 'shell-path-copy-format-name', text: fmt.name });

		const stateButton = row.createEl('button', {
			cls: 'shell-path-copy-state-button',
			text: fmt.enabled ? 'On' : 'Off'
		});
		if (!fmt.enabled) {
			stateButton.addClass('is-off');
		}
		stateButton.addEventListener('click', () => {
			fmt.enabled = !fmt.enabled;
			void this.plugin.saveSettings();
			new Notice(RELOAD_NOTICE);
			this.display();
		});

		const editButton = row.createEl('button', { text: expanded ? 'Close' : 'Edit' });
		editButton.addEventListener('click', () => {
			this.expandedId = expanded ? null : fmt.id;
			this.display();
		});

		if (expanded) {
			this.renderFormatEditor(listEl, fmt, index, nameSpan, iconEl);
		}
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

	// Renders the expanded editor panel for one format.
	private renderFormatEditor(
		listEl: HTMLElement,
		fmt: CustomFormat,
		index: number,
		nameSpan: HTMLElement,
		iconEl: HTMLElement
	): void {
		const editor = listEl.createDiv({ cls: 'shell-path-copy-format-editor' });
		let previewEl: HTMLElement;
		let infoEl: HTMLElement;
		let pendingDelete = false;

		new Setting(editor)
			.setName('Name')
			.addText(text => text
				.setValue(fmt.name)
				.onChange(async (value) => {
					fmt.name = value;
					nameSpan.setText(value);
					await this.plugin.saveSettings();
				}));

		new Setting(editor)
			.setName('Icon')
			.setDesc('Icon shown next to this format in the menu')
			.addDropdown(dropdown => {
				for (const icon of ICON_CHOICES) {
					dropdown.addOption(icon, icon);
				}
				dropdown.setValue(ICON_CHOICES.includes(fmt.icon) ? fmt.icon : 'clipboard-copy');
				dropdown.onChange(async (value) => {
					fmt.icon = value;
					setIcon(iconEl, value);
					await this.plugin.saveSettings();
				});
			});

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
				}));

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
			.setName('Delete this format')
			.addButton(button => button
				.setButtonText('Delete')
				.setWarning()
				.onClick(async () => {
					if (!pendingDelete) {
						pendingDelete = true;
						button.setButtonText('Click again to confirm');
						return;
					}
					this.plugin.settings.customFormats.splice(index, 1);
					this.expandedId = null;
					await this.plugin.saveSettings();
					new Notice(RELOAD_NOTICE);
					this.display();
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

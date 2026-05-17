import { App, Menu, Notice, Plugin, PluginSettingTab, Setting, TAbstractFile, TFile, TextAreaComponent, Platform, FileSystemAdapter } from 'obsidian';
import { wrapPath, formatRelativePath, buildFileUrl, buildObsidianUrl, buildMarkdownLink, extractFilename, PathWrapping, MarkdownLinkFormat } from './path-utils';
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


// A user-defined custom copy format (issue 13). Each entry produces its own
// context-menu item and command-palette command via the token engine.
interface CustomFormat {
	id: string;            // stable unique id, used for command ids
	name: string;
	template: string;
	wrapping: PathWrapping; // applied around the rendered result
	enabled: boolean;
	showInMenu: boolean;
	showInCommands: boolean;
}

interface PathCopySettings {
	pathWrapping: PathWrapping;
	showNotifications: boolean;
	menuDisplay: 'both' | 'windows' | 'linux-mac';
	showAbsolutePath: boolean;
	showFileUrl: boolean;
	showObsidianUrl: boolean;
	showMarkdownLink: boolean;
	markdownLinkFormat: MarkdownLinkFormat;
	showFilename: boolean;
	showFilenameWithExt: boolean;
	filenameUseWrapping: boolean;
	customFormats: CustomFormat[];
	warnOnUnresolvedTokens: boolean;
	seededBuiltins: boolean; // true once the built-in seed formats have been added
}

const DEFAULT_SETTINGS: PathCopySettings = {
	pathWrapping: 'backticks',
	showNotifications: true,
	menuDisplay: 'both',
	showAbsolutePath: true,
	showFileUrl: true,
	showObsidianUrl: true,
	showMarkdownLink: true,
	markdownLinkFormat: 'wiki-style',
	showFilename: true,
	showFilenameWithExt: true,
	filenameUseWrapping: false,
	customFormats: [],
	warnOnUnresolvedTokens: true,
	seededBuiltins: false
}

// The built-in formats expressed as token templates. Seeded once into a vault's
// custom-format list as disabled, editable starting points. The 8 live built-in
// commands and menu items are unaffected; these seeds only become visible if the
// user enables them. Path formats default to backtick wrapping (shell-friendly,
// the plugin default); URLs, links, and filenames are left unwrapped.
function builtinSeedFormats(): CustomFormat[] {
	const seeds: Array<Omit<CustomFormat, 'id' | 'enabled' | 'showInMenu' | 'showInCommands'>> = [
		{ name: 'Linux/macOS path', template: '<relative-path-unix>', wrapping: 'backticks' },
		{ name: 'Windows path', template: '<relative-path-windows>', wrapping: 'backticks' },
		{ name: 'Absolute path', template: '<absolute-path>', wrapping: 'backticks' },
		{ name: 'file:// URL', template: '<file-url>', wrapping: 'none' },
		{ name: 'Obsidian URL', template: '<obsidian-url>', wrapping: 'none' },
		{ name: 'Markdown link', template: '<markdown-link>', wrapping: 'none' },
		{ name: 'Filename', template: '<filename>', wrapping: 'none' },
		{ name: 'Filename with extension', template: '<filename-ext>', wrapping: 'none' }
	];
	return seeds.map((seed) => ({
		id: generateFormatId(),
		name: seed.name,
		template: seed.template,
		wrapping: seed.wrapping,
		enabled: false,
		showInMenu: true,
		showInCommands: true
	}));
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

// Coerces possibly-corrupt or hand-edited persisted data into a valid CustomFormat
// array. Anything missing falls back to a safe default.
function normalizeCustomFormats(value: unknown): CustomFormat[] {
	if (!Array.isArray(value)) {
		return [];
	}
	const validWrapping: PathWrapping[] = ['none', 'double-quotes', 'single-quotes', 'backticks'];
	return value.map((raw): CustomFormat => {
		const item = (raw ?? {}) as Partial<CustomFormat>;
		const wrapping = validWrapping.includes(item.wrapping as PathWrapping)
			? (item.wrapping as PathWrapping)
			: 'none';
		return {
			id: typeof item.id === 'string' && item.id ? item.id : generateFormatId(),
			name: typeof item.name === 'string' ? item.name : 'Custom format',
			template: typeof item.template === 'string' ? item.template : '',
			wrapping,
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

		// Register the context menu event for files and folders
		this.registerEvent(
			this.app.workspace.on('file-menu', (menu: Menu, file: TAbstractFile) => {
				this.addPathCopyMenuItems(menu, file);
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
		const data = (await this.loadData()) as Partial<PathCopySettings> | null;
		this.settings = Object.assign({}, DEFAULT_SETTINGS, data);
		// Object.assign is shallow: guard the custom-formats array against a
		// corrupt or hand-edited data.json and fill any missing per-item fields.
		this.settings.customFormats = normalizeCustomFormats(this.settings.customFormats);

		// Seed the built-in formats as disabled, editable starting points. The
		// flag ensures this happens exactly once per vault, so formats the user
		// later deletes are not re-created.
		if (!this.settings.seededBuiltins) {
			this.settings.customFormats.push(...builtinSeedFormats());
			this.settings.seededBuiltins = true;
			await this.saveSettings();
		}
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	private registerCommands() {
		const showBoth = this.settings.menuDisplay === 'both';
		const showWindows = this.settings.menuDisplay === 'windows';
		const showLinuxMac = this.settings.menuDisplay === 'linux-mac';

		// Direct format commands (always registered, respecting menuDisplay setting)
		if (showBoth || showLinuxMac) {
			this.addCommand({
				id: 'copy-unix-path',
				name: 'Copy as Linux/macOS path',
				callback: () => {
					const file = this.getActiveOrFocusedFile();
					if (file) {
						void this.copyPath(file, 'unix');
					}
				}
			});
		}

		if (showBoth || showWindows) {
			this.addCommand({
				id: 'copy-windows-path',
				name: 'Copy as Windows path',
				callback: () => {
					const file = this.getActiveOrFocusedFile();
					if (file) {
						void this.copyPath(file, 'windows');
					}
				}
			});
		}

		// Add absolute path command ONLY on desktop and if enabled
		if (!Platform.isMobile && this.settings.showAbsolutePath) {
			// Determine OS-specific naming for clarity
			const osName = Platform.isWin ? 'Windows' : 'Linux/macOS';

			this.addCommand({
				id: 'copy-absolute-path',
				name: `Copy as absolute ${osName} path`,
				callback: () => {
					const file = this.getActiveOrFocusedFile();
					if (file) {
						void this.copyAbsolutePath(file);
					}
				}
			});
		}

		// Add file URL command ONLY on desktop and if enabled
		if (!Platform.isMobile && this.settings.showFileUrl) {
			this.addCommand({
				id: 'copy-file-url',
				name: 'Copy as file:// URL',
				callback: () => {
					const file = this.getActiveOrFocusedFile();
					if (file) {
						void this.copyFileUrl(file);
					}
				}
			});
		}

		// Add Obsidian URL command if enabled
		if (this.settings.showObsidianUrl) {
			this.addCommand({
				id: 'copy-obsidian-url',
				name: 'Copy as Obsidian URL',
				callback: () => {
					const file = this.getActiveOrFocusedFile();
					if (file) {
						void this.copyObsidianUrl(file);
					}
				}
			});
		}

		// Add markdown link command if enabled
		if (this.settings.showMarkdownLink) {
			this.addCommand({
				id: 'copy-markdown-link',
				name: 'Copy as Markdown link',
				callback: () => {
					const file = this.getActiveOrFocusedFile();
					if (file) {
						void this.copyMarkdownLink(file);
					}
				}
			});
		}

		// Add filename command if enabled
		if (this.settings.showFilename) {
			this.addCommand({
				id: 'copy-filename',
				name: 'Copy filename',
				callback: () => {
					const file = this.getActiveOrFocusedFile();
					if (file) {
						void this.copyFilename(file, false);
					}
				}
			});
		}

		// Add filename with extension command if enabled
		if (this.settings.showFilenameWithExt) {
			this.addCommand({
				id: 'copy-filename-with-ext',
				name: 'Copy filename with extension',
				callback: () => {
					const file = this.getActiveOrFocusedFile();
					if (file) {
						void this.copyFilename(file, true);
					}
				}
			});
		}

		// Register a command for each enabled custom format. Commands register
		// once at onload; adding or renaming a format needs an Obsidian reload,
		// consistent with the menuDisplay setting's existing behavior.
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

	private createPathMenuItem(menu: Menu, file: TAbstractFile, format: 'unix' | 'windows') {
		const isUnix = format === 'unix';
		const title = isUnix ? 'Copy relative Linux/macOS path' : 'Copy relative Windows path';
		const icon = isUnix ? 'terminal' : 'folder-closed';

		menu.addItem((item) => {
			item
				.setTitle(title)
				.setIcon(icon)
				.setSection('shell-path-copy')
				.onClick(async () => {
					await this.copyPath(file, format);
				});
		});
	}

	private addPathCopyMenuItems(menu: Menu, file: TAbstractFile) {
		const showBoth = this.settings.menuDisplay === 'both';
		const showWindows = this.settings.menuDisplay === 'windows';
		const showLinuxMac = this.settings.menuDisplay === 'linux-mac';

		menu.addSeparator();

		// Show relative path options based on settings
		if (showBoth || showLinuxMac) {
			this.createPathMenuItem(menu, file, 'unix');
		}

		if (showBoth || showWindows) {
			this.createPathMenuItem(menu, file, 'windows');
		}

		// Add absolute path option ONLY on desktop and if enabled
		if (!Platform.isMobile && this.settings.showAbsolutePath) {
			// Determine OS-specific naming and icon for clarity
			const osName = Platform.isWin ? 'Windows' : 'Linux/macOS';
			const icon = Platform.isWin ? 'folder-closed' : 'terminal';

			menu.addItem((item) => {
				item
					.setTitle(`Copy absolute ${osName} path`)
					.setIcon(icon)
					.setSection('shell-path-copy')
					.onClick(async () => {
						await this.copyAbsolutePath(file);
					});
			});
		}

		// Add file URL option ONLY on desktop and if enabled
		if (!Platform.isMobile && this.settings.showFileUrl) {
			menu.addItem((item) => {
				item
					.setTitle('Copy as file:// URL')
					.setIcon('globe')
					.setSection('shell-path-copy')
					.onClick(async () => {
						await this.copyFileUrl(file);
					});
			});
		}

		// Add Obsidian URL option if enabled
		if (this.settings.showObsidianUrl) {
			menu.addItem((item) => {
				item
					.setTitle('Copy as Obsidian URL')
					.setIcon('link-2')
					.setSection('shell-path-copy')
					.onClick(async () => {
						await this.copyObsidianUrl(file);
					});
			});
		}

		// Add markdown link option if enabled
		if (this.settings.showMarkdownLink) {
			menu.addItem((item) => {
				item
					.setTitle('Copy as Markdown link')
					.setIcon('link')
					.setSection('shell-path-copy')
					.onClick(async () => {
						await this.copyMarkdownLink(file);
					});
			});
		}

		// Add filename option if enabled
		if (this.settings.showFilename) {
			menu.addItem((item) => {
				item
					.setTitle('Copy filename')
					.setIcon('file-text')
					.setSection('shell-path-copy')
					.onClick(async () => {
						await this.copyFilename(file, false);
					});
			});
		}

		// Add filename with extension option if enabled
		if (this.settings.showFilenameWithExt) {
			menu.addItem((item) => {
				item
					.setTitle('Copy filename with extension')
					.setIcon('file')
					.setSection('shell-path-copy')
					.onClick(async () => {
						await this.copyFilename(file, true);
					});
			});
		}

		// Add a menu item for each enabled custom format. The menu is rebuilt on
		// every right-click, so menu changes take effect without a reload.
		for (const fmt of this.settings.customFormats) {
			if (!fmt.enabled || !fmt.showInMenu) {
				continue;
			}
			const formatId = fmt.id;
			menu.addItem((item) => {
				item
					.setTitle(fmt.name)
					.setIcon('clipboard-copy')
					.setSection('shell-path-copy')
					.onClick(async () => {
						await this.copyCustomFormat(formatId, file);
					});
			});
		}
	}

	async copyPath(file: TAbstractFile, format: 'unix' | 'windows') {
		try {
			if (!navigator.clipboard) {
				throw new Error('Clipboard API not available.');
			}

			const relativePath = formatRelativePath(file.path, format);
			const wrappedPath = wrapPath(relativePath, this.settings.pathWrapping);

			// Copy to clipboard
			await navigator.clipboard.writeText(wrappedPath);

			// Show notification if enabled
			if (this.settings.showNotifications) {
				const formatName = format === 'unix' ? 'Linux/macOS' : 'Windows';
				new Notice(`${formatName} path copied!`);
			}
		} catch (error) {
			// Check the error message to provide more specific feedback
			if (error instanceof Error && error.message.includes('Clipboard API')) {
				new Notice('Error: Clipboard API is not available in this environment.');
			} else {
				console.error('Shell Path Copy: Failed to copy path:', error);
				new Notice('Failed to copy path. See console for details.');
			}
		}
	}

	async copyAbsolutePath(file: TAbstractFile) {
		try {
			if (!navigator.clipboard) {
				throw new Error('Clipboard API not available.');
			}

			// Only attempt to get absolute path on desktop
			// This is a failsafe - should never be reached on mobile since
			// the command and menu items are not registered on mobile platforms
			if (Platform.isMobile) {
				new Notice('Absolute paths are not available on mobile devices.');
				return;
			}

			// Get the absolute system path using the public FileSystemAdapter API
			const adapter = this.app.vault.adapter;

			if (!(adapter instanceof FileSystemAdapter)) {
				throw new Error('File system adapter not available.');
			}

			const absolutePath = getNodePath().join(adapter.getBasePath(), file.path);

			const wrappedPath = wrapPath(absolutePath, this.settings.pathWrapping);

			// Copy to clipboard
			await navigator.clipboard.writeText(wrappedPath);

			// Show notification if enabled
			if (this.settings.showNotifications) {
				new Notice('Absolute path copied!');
			}
		} catch (error) {
			if (error instanceof Error && error.message.includes('Clipboard API')) {
				new Notice('Error: Clipboard API is not available in this environment.');
			} else {
				console.error('Shell Path Copy: Failed to copy absolute path:', error);
				new Notice('Failed to copy absolute path. See console for details.');
			}
		}
	}

	async copyFileUrl(file: TAbstractFile) {
		try {
			if (!navigator.clipboard) {
				throw new Error('Clipboard API not available.');
			}
			
			// Only attempt to get absolute path on desktop
			if (Platform.isMobile) {
				new Notice('The file URL feature is not available on mobile devices.');
				return;
			}
			
			// Get the absolute system path using the public FileSystemAdapter API
			const adapter = this.app.vault.adapter;

			if (!(adapter instanceof FileSystemAdapter)) {
				throw new Error('File system adapter not available.');
			}

			const absolutePath = getNodePath().join(adapter.getBasePath(), file.path);
			const fileUrl = buildFileUrl(absolutePath);

			// Copy to clipboard (file URLs are typically not wrapped in quotes)
			await navigator.clipboard.writeText(fileUrl);

			// Show notification if enabled
			if (this.settings.showNotifications) {
				new Notice('File URL copied!');
			}
		} catch (error) {
			if (error instanceof Error && error.message.includes('Clipboard API')) {
				new Notice('Error: Clipboard API is not available in this environment.');
			} else {
				console.error('Shell Path Copy: Failed to copy file URL:', error);
				new Notice('Failed to copy file URL. See console for details.');
			}
		}
	}

	async copyMarkdownLink(file: TAbstractFile) {
		try {
			if (!navigator.clipboard) {
				throw new Error('Clipboard API not available.');
			}

			const markdownLink = buildMarkdownLink(file.name, file.path, this.settings.markdownLinkFormat);

			// Copy to clipboard
			await navigator.clipboard.writeText(markdownLink);

			// Show notification if enabled
			if (this.settings.showNotifications) {
				const formatName = this.settings.markdownLinkFormat === 'wiki-style' ?
					'Wiki-style link' : 'Markdown link';
				new Notice(`${formatName} copied!`);
			}
		} catch (error) {
			if (error instanceof Error && error.message.includes('Clipboard API')) {
				new Notice('Error: Clipboard API is not available in this environment.');
			} else {
				console.error('Shell Path Copy: Failed to copy Markdown link:', error);
				new Notice('Failed to copy Markdown link. See console for details.');
			}
		}
	}

	async copyObsidianUrl(file: TAbstractFile) {
		try {
			if (!navigator.clipboard) {
				throw new Error('Clipboard API not available.');
			}

			const obsidianUrl = buildObsidianUrl(this.app.vault.getName(), file.path);

			// Copy to clipboard
			await navigator.clipboard.writeText(obsidianUrl);
			
			// Show notification if enabled
			if (this.settings.showNotifications) {
				new Notice('Obsidian URL copied!');
			}
		} catch (error) {
			if (error instanceof Error && error.message.includes('Clipboard API')) {
				new Notice('Error: Clipboard API is not available in this environment.');
			} else {
				console.error('Shell Path Copy: Failed to copy Obsidian URL:', error);
				new Notice('Failed to copy Obsidian URL. See console for details.');
			}
		}
	}

	async copyFilename(file: TAbstractFile, includeExtension: boolean) {
		try {
			if (!navigator.clipboard) {
				throw new Error('Clipboard API not available.');
			}

			const filename = extractFilename(file.name, includeExtension);
			const result = this.settings.filenameUseWrapping
				? wrapPath(filename, this.settings.pathWrapping)
				: filename;

			await navigator.clipboard.writeText(result);

			if (this.settings.showNotifications) {
				new Notice('Filename copied!');
			}
		} catch (error) {
			if (error instanceof Error && error.message.includes('Clipboard API')) {
				new Notice('Error: Clipboard API is not available in this environment.');
			} else {
				console.error('Shell Path Copy: Failed to copy filename:', error);
				new Notice('Failed to copy filename. See console for details.');
			}
		}
	}

	// Assembles the token context for a copy. All Obsidian API access for the
	// token engine happens here so the engine itself stays pure and testable.
	private buildTokenContext(file: TAbstractFile): TokenContext {
		let absolutePath: string | null = null;
		if (!Platform.isMobile) {
			const adapter = this.app.vault.adapter;
			if (adapter instanceof FileSystemAdapter) {
				absolutePath = getNodePath().join(adapter.getBasePath(), file.path);
			}
		}

		// The line number belongs to the editor's file, not necessarily the file
		// being copied. Only resolve it when the two are the same file.
		let lineNumber: number | null = null;
		const activeEditor = this.app.workspace.activeEditor;
		if (activeEditor?.editor && activeEditor.file?.path === file.path) {
			lineNumber = activeEditor.editor.getCursor().line + 1;
		}

		return {
			fileName: file.name,
			filePath: file.path,
			isFolder: !(file instanceof TFile),
			vaultName: this.app.vault.getName(),
			isWindows: Platform.isWin,
			absolutePath,
			lineNumber,
			markdownLinkFormat: this.settings.markdownLinkFormat,
			now: new Date()
		};
	}

	async copyCustomFormat(formatId: string, file: TAbstractFile) {
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

			const applied = applyTemplate(fmt.template, this.buildTokenContext(file));
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

class ShellPathCopySettingTab extends PluginSettingTab {
	plugin: ShellPathCopyPlugin;

	constructor(app: App, plugin: ShellPathCopyPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		// Path format examples
		new Setting(containerEl)
			.setName('Path format examples')
			.setHeading();
		const examplesDiv = containerEl.createDiv({ cls: 'setting-item-description' });
		examplesDiv.createDiv({ text: '• Relative Linux/macOS: ./folder/subfolder/file.md' });
		examplesDiv.createDiv({ text: '• Relative Windows: .\\folder\\subfolder\\file.md' });
		examplesDiv.createDiv({ text: '• Absolute Windows: C:\\Users\\name\\vault\\folder\\file.md' });
		examplesDiv.createDiv({ text: '• Absolute Linux/macOS: /home/user/vault/folder/file.md' });
		examplesDiv.createDiv({ text: '• File URL: file:///C:/Users/name/vault/folder/file.md (Windows) or file:///home/user/vault/folder/file.md (Linux/macOS)' });
		examplesDiv.createDiv({ text: '• Obsidian URL: obsidian://open?vault=MyVault&file=folder/file' });
		examplesDiv.createDiv({ text: '• Markdown link: [[filename]] (wiki-style) or [filename.md](./path/filename.md) (standard)' });
		examplesDiv.createDiv({ text: '• Filename: file (without extension) or file.md (with extension)' });

		new Setting(containerEl)
			.setName('Path wrapping')
			.setDesc('Choose how paths are wrapped when copied to clipboard (useful for paths with spaces)')
			.addDropdown(dropdown => dropdown
				.addOption('none', 'None - /path with spaces/file.md')
				.addOption('double-quotes', 'Double quotes - "/path with spaces/file.md"')
				.addOption('single-quotes', 'Single quotes - \'/path with spaces/file.md\'')
				.addOption('backticks', 'Backticks - `/path with spaces/file.md`')
				.setValue(this.plugin.settings.pathWrapping)
				.onChange(async (value) => {
					this.plugin.settings.pathWrapping = value as PathCopySettings['pathWrapping'];
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Menu display')
			.setDesc('Control which path formats appear in the context menu')
			.addDropdown(dropdown => dropdown
				.addOption('both', 'Show both Windows and Linux/macOS options')
				.addOption('windows', 'Show Windows options only')
				.addOption('linux-mac', 'Show Linux/macOS options only')
				.setValue(this.plugin.settings.menuDisplay)
				.onChange(async (value) => {
					this.plugin.settings.menuDisplay = value as PathCopySettings['menuDisplay'];
					await this.plugin.saveSettings();
					new Notice('Please reload Obsidian for command palette changes to take effect');
				}));

		new Setting(containerEl)
			.setName('Show notifications')
			.setDesc('Display a notification when a path is copied')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.showNotifications)
				.onChange(async (value) => {
					this.plugin.settings.showNotifications = value;
					await this.plugin.saveSettings();
				}));

		// ── Paths ────────────────────────────────────────────────────────
		if (!Platform.isMobile) {
			new Setting(containerEl)
				.setName('Paths')
				.setHeading();

			new Setting(containerEl)
				.setName('Show absolute path option')
				.setDesc('Display absolute path copy option in menus (desktop only)')
				.addToggle(toggle => toggle
					.setValue(this.plugin.settings.showAbsolutePath)
					.onChange(async (value) => {
						this.plugin.settings.showAbsolutePath = value;
						await this.plugin.saveSettings();
						new Notice('Please reload Obsidian for command palette changes to take effect');
					}));

			new Setting(containerEl)
				.setName('Show file:// URL option')
				.setDesc('Display the file:// URL copy option in menus (desktop only)')
				.addToggle(toggle => toggle
					.setValue(this.plugin.settings.showFileUrl)
					.onChange(async (value) => {
						this.plugin.settings.showFileUrl = value;
						await this.plugin.saveSettings();
						new Notice('Please reload Obsidian for command palette changes to take effect');
					}));
		}

		// ── Links ────────────────────────────────────────────────────────
		new Setting(containerEl)
			.setName('Links')
			.setHeading();

		new Setting(containerEl)
			.setName('Show Obsidian URL option')
			.setDesc('Display the Obsidian URL copy option in menus')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.showObsidianUrl)
				.onChange(async (value) => {
					this.plugin.settings.showObsidianUrl = value;
					await this.plugin.saveSettings();
					new Notice('Please reload Obsidian for command palette changes to take effect');
				}));

		new Setting(containerEl)
			.setName('Show Markdown link option')
			.setDesc('Display the Markdown link copy option in menus')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.showMarkdownLink)
				.onChange(async (value) => {
					this.plugin.settings.showMarkdownLink = value;
					await this.plugin.saveSettings();
					new Notice('Please reload Obsidian for command palette changes to take effect');
				}));

		if (this.plugin.settings.showMarkdownLink) {
			new Setting(containerEl)
				.setName('Markdown link format')
				.setDesc('Choose the format for Markdown links')
				.addDropdown(dropdown => dropdown
					.addOption('wiki-style', 'Wiki-style - [[filename]]')
					.addOption('standard-markdown', 'Standard Markdown - [filename](path)')
					.setValue(this.plugin.settings.markdownLinkFormat)
					.onChange(async (value) => {
						this.plugin.settings.markdownLinkFormat = value as PathCopySettings['markdownLinkFormat'];
						await this.plugin.saveSettings();
					}));
		}

		// ── Filenames ────────────────────────────────────────────────────
		new Setting(containerEl)
			.setName('Filenames')
			.setHeading();

		new Setting(containerEl)
			.setName('Show filename option')
			.setDesc('Display the copy filename (without extension) option in menus')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.showFilename)
				.onChange(async (value) => {
					this.plugin.settings.showFilename = value;
					await this.plugin.saveSettings();
					new Notice('Please reload Obsidian for command palette changes to take effect');
				}));

		new Setting(containerEl)
			.setName('Show filename with extension option')
			.setDesc('Display the copy filename (with extension) option in menus')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.showFilenameWithExt)
				.onChange(async (value) => {
					this.plugin.settings.showFilenameWithExt = value;
					await this.plugin.saveSettings();
					new Notice('Please reload Obsidian for command palette changes to take effect');
				}));

		if (this.plugin.settings.showFilename || this.plugin.settings.showFilenameWithExt) {
			new Setting(containerEl)
				.setName('Apply path wrapping to filenames')
				.setDesc('Use the path wrapping setting above when copying filenames')
				.addToggle(toggle => toggle
					.setValue(this.plugin.settings.filenameUseWrapping)
					.onChange(async (value) => {
						this.plugin.settings.filenameUseWrapping = value;
						await this.plugin.saveSettings();
					}));
		}

		// ── Custom formats ───────────────────────────────────────────────
		this.renderCustomFormatsSection(containerEl);

		// Add support links at the bottom
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
			markdownLinkFormat: this.plugin.settings.markdownLinkFormat,
			now: new Date()
		};
	}

	// Renders the live preview line and portability badges for one template.
	private renderPreview(previewEl: HTMLElement, badgesEl: HTMLElement, template: string): void {
		previewEl.empty();
		badgesEl.empty();

		if (template.trim() === '') {
			previewEl.setText('Preview: (empty template)');
			return;
		}

		const applied = applyTemplate(template, this.sampleContext());
		previewEl.setText(`Preview: ${applied.text}`);

		const shownBadges = new Set<string>();
		for (const issue of validateTemplate(template)) {
			let label: string;
			switch (issue.kind) {
				case 'unknown-token': label = issue.detail; break;
				case 'desktop-only-token': label = 'Not portable: blank on mobile'; break;
				case 'editor-only-token': label = 'Needs the file open in the editor'; break;
				default: label = issue.detail; break;
			}
			if (shownBadges.has(label)) {
				continue;
			}
			shownBadges.add(label);
			badgesEl.createSpan({ cls: 'shell-path-copy-badge-warn', text: label });
		}
	}

	// Renders the "Custom formats" settings section.
	private renderCustomFormatsSection(containerEl: HTMLElement): void {
		new Setting(containerEl).setName('Custom formats').setHeading();

		const intro = containerEl.createDiv({ cls: 'setting-item-description' });
		intro.createDiv({
			text: 'Define your own copy formats using tokens. Each format becomes a context-menu item and a command.'
		});

		const tokenList = intro.createDiv({ cls: 'shell-path-copy-token-list' });
		for (const token of listTokens()) {
			const row = tokenList.createDiv();
			row.createSpan({ cls: 'shell-path-copy-token-name', text: `<${token.name}>` });
			let suffix = ` ${token.description}`;
			if (token.tier === 'desktop') {
				suffix += ' (desktop only)';
			} else if (token.tier === 'editor') {
				suffix += ' (editor only)';
			}
			row.createSpan({ text: suffix });
		}

		const formats = this.plugin.settings.customFormats;
		formats.forEach((fmt, index) => {
			this.renderCustomFormat(containerEl, fmt, index);
		});

		new Setting(containerEl)
			.addButton(button => button
				.setButtonText('Add custom format')
				.setCta()
				.onClick(async () => {
					this.plugin.settings.customFormats.push({
						id: generateFormatId(),
						name: 'New format',
						template: '',
						wrapping: 'none',
						enabled: true,
						showInMenu: true,
						showInCommands: true
					});
					await this.plugin.saveSettings();
					new Notice('Please reload Obsidian for command palette changes to take effect');
					this.display();
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
	}

	// Renders the editor card for a single custom format.
	private renderCustomFormat(containerEl: HTMLElement, fmt: CustomFormat, index: number): void {
		const card = containerEl.createDiv({ cls: 'shell-path-copy-format-card' });
		let pendingDelete = false;
		let previewEl: HTMLElement;
		let badgesEl: HTMLElement;

		new Setting(card)
			.setName('Name')
			.addText(text => text
				.setValue(fmt.name)
				.onChange(async (value) => {
					fmt.name = value;
					await this.plugin.saveSettings();
				}))
			.addExtraButton(btn => btn
				.setIcon('arrow-up')
				.onClick(() => {
					const list = this.plugin.settings.customFormats;
					if (index === 0) {
						return;
					}
					[list[index - 1], list[index]] = [list[index], list[index - 1]];
					void this.plugin.saveSettings();
					this.display();
				}))
			.addExtraButton(btn => btn
				.setIcon('arrow-down')
				.onClick(() => {
					const list = this.plugin.settings.customFormats;
					if (index === list.length - 1) {
						return;
					}
					[list[index + 1], list[index]] = [list[index], list[index + 1]];
					void this.plugin.saveSettings();
					this.display();
				}))
			.addExtraButton(btn => btn
				.setIcon('trash')
				.onClick(() => {
					if (!pendingDelete) {
						pendingDelete = true;
						btn.setIcon('alert-triangle');
						return;
					}
					this.plugin.settings.customFormats.splice(index, 1);
					void this.plugin.saveSettings();
					new Notice('Please reload Obsidian for command palette changes to take effect');
					this.display();
				}));

		let templateRef: TextAreaComponent;
		new Setting(card)
			.setName('Template')
			.setDesc('Use tokens like <filename>. Click a token below to insert it at the cursor.')
			.addTextArea(text => {
				templateRef = text;
				text.setValue(fmt.template)
					.setPlaceholder('<filename> -> <obsidian-url>')
					.onChange(async (value) => {
						fmt.template = value;
						this.renderPreview(previewEl, badgesEl, value);
						await this.plugin.saveSettings();
					});
				text.inputEl.addClass('shell-path-copy-template-input');
			});

		// Token palette: clicking a token inserts <token> at the cursor.
		const palette = card.createDiv({ cls: 'shell-path-copy-token-palette' });
		for (const token of listTokens()) {
			const button = palette.createEl('button', {
				cls: 'shell-path-copy-token-button',
				text: `<${token.name}>`
			});
			button.addEventListener('click', () => {
				const input = templateRef.inputEl;
				const insert = `<${token.name}>`;
				const start = input.selectionStart;
				const end = input.selectionEnd;
				const next = input.value.slice(0, start) + insert + input.value.slice(end);
				templateRef.setValue(next);
				fmt.template = next;
				this.renderPreview(previewEl, badgesEl, next);
				void this.plugin.saveSettings();
				input.focus();
				const caret = start + insert.length;
				input.setSelectionRange(caret, caret);
			});
		}

		previewEl = card.createDiv({ cls: 'shell-path-copy-template-preview' });
		badgesEl = card.createDiv({ cls: 'shell-path-copy-badges' });
		this.renderPreview(previewEl, badgesEl, fmt.template);

		new Setting(card)
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
					this.renderPreview(previewEl, badgesEl, fmt.template);
					await this.plugin.saveSettings();
				}));

		new Setting(card)
			.setName('Enabled')
			.setDesc('Turn this format on or off')
			.addToggle(toggle => toggle
				.setValue(fmt.enabled)
				.onChange(async (value) => {
					fmt.enabled = value;
					await this.plugin.saveSettings();
					new Notice('Please reload Obsidian for command palette changes to take effect');
				}));

		new Setting(card)
			.setName('Show in menu')
			.setDesc('Display this format in the file explorer right-click menu')
			.addToggle(toggle => toggle
				.setValue(fmt.showInMenu)
				.onChange(async (value) => {
					fmt.showInMenu = value;
					await this.plugin.saveSettings();
				}));

		new Setting(card)
			.setName('Show in command palette')
			.setDesc('Register this format as a command')
			.addToggle(toggle => toggle
				.setValue(fmt.showInCommands)
				.onChange(async (value) => {
					fmt.showInCommands = value;
					await this.plugin.saveSettings();
					new Notice('Please reload Obsidian for command palette changes to take effect');
				}));
	}
}
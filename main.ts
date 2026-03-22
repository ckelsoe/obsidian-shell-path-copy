import { App, Menu, Notice, Plugin, PluginSettingTab, Setting, TAbstractFile, Platform, FileSystemAdapter } from 'obsidian';
import * as path from 'path';
import { wrapPath, formatRelativePath, buildFileUrl, buildObsidianUrl, buildMarkdownLink, extractFilename, PathWrapping, MarkdownLinkFormat } from './path-utils';


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
	filenameUseWrapping: false
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
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
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
				name: 'Copy as Linux/Mac path',
				callback: () => {
					const file = this.getActiveOrFocusedFile();
					if (file) {
						this.copyPath(file, 'unix');
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
						this.copyPath(file, 'windows');
					}
				}
			});
		}

		// Add absolute path command ONLY on desktop and if enabled
		if (!Platform.isMobile && this.settings.showAbsolutePath) {
			// Determine OS-specific naming for clarity
			const isWindows = process.platform === 'win32';
			const osName = isWindows ? 'Windows' : 'Linux/Mac';

			this.addCommand({
				id: 'copy-absolute-path',
				name: `Copy as absolute ${osName} path`,
				callback: () => {
					const file = this.getActiveOrFocusedFile();
					if (file) {
						this.copyAbsolutePath(file);
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
						this.copyFileUrl(file);
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
						this.copyObsidianUrl(file);
					}
				}
			});
		}

		// Add markdown link command if enabled
		if (this.settings.showMarkdownLink) {
			this.addCommand({
				id: 'copy-markdown-link',
				name: 'Copy as markdown link',
				callback: () => {
					const file = this.getActiveOrFocusedFile();
					if (file) {
						this.copyMarkdownLink(file);
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
						this.copyFilename(file, false);
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
						this.copyFilename(file, true);
					}
				}
			});
		}
	}

	private createPathMenuItem(menu: Menu, file: TAbstractFile, format: 'unix' | 'windows') {
		const isUnix = format === 'unix';
		const title = isUnix ? 'Copy Relative Linux/Mac Path' : 'Copy Relative Windows Path';
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
			const isWindows = process.platform === 'win32';
			const osName = isWindows ? 'Windows' : 'Linux/Mac';
			const icon = isWindows ? 'folder-closed' : 'terminal';

			menu.addItem((item) => {
				item
					.setTitle(`Copy Absolute ${osName} Path`)
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
					.setTitle('Copy as Markdown Link')
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
					.setTitle('Copy Filename')
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
					.setTitle('Copy Filename with Extension')
					.setIcon('file')
					.setSection('shell-path-copy')
					.onClick(async () => {
						await this.copyFilename(file, true);
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
				const formatName = format === 'unix' ? 'Linux/Mac' : 'Windows';
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

			const absolutePath = path.join(adapter.getBasePath(), file.path);

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
				new Notice('File URLs are not available on mobile devices.');
				return;
			}
			
			// Get the absolute system path using the public FileSystemAdapter API
			const adapter = this.app.vault.adapter;

			if (!(adapter instanceof FileSystemAdapter)) {
				throw new Error('File system adapter not available.');
			}

			const absolutePath = path.join(adapter.getBasePath(), file.path);
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
				console.error('Shell Path Copy: Failed to copy markdown link:', error);
				new Notice('Failed to copy markdown link. See console for details.');
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
		containerEl.createEl('div', {
			text: 'Path format examples:',
			cls: 'setting-item-heading'
		});
		const examplesDiv = containerEl.createEl('div', { cls: 'setting-item-description' });
		examplesDiv.createEl('div', { text: '• Relative Linux/Mac: ./folder/subfolder/file.md' });
		examplesDiv.createEl('div', { text: '• Relative Windows: .\\folder\\subfolder\\file.md' });
		examplesDiv.createEl('div', { text: '• Absolute Windows: C:\\Users\\name\\vault\\folder\\file.md' });
		examplesDiv.createEl('div', { text: '• Absolute Linux/Mac: /home/user/vault/folder/file.md' });
		examplesDiv.createEl('div', { text: '• File URL: file:///C:/Users/name/vault/folder/file.md (Windows) or file:///home/user/vault/folder/file.md (Linux/Mac)' });
		examplesDiv.createEl('div', { text: '• Obsidian URL: obsidian://open?vault=MyVault&file=folder/file' });
		examplesDiv.createEl('div', { text: '• Markdown Link: [[filename]] (wiki-style) or [filename.md](./path/filename.md) (standard)' });
		examplesDiv.createEl('div', { text: '• Filename: file (without extension) or file.md (with extension)' });

		// ── General ──────────────────────────────────────────────────────
		new Setting(containerEl)
			.setName('General')
			.setHeading();

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
				.addOption('both', 'Show both Windows and Linux/Mac options')
				.addOption('windows', 'Show Windows options only')
				.addOption('linux-mac', 'Show Linux/Mac options only')
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

		// ── Path options ─────────────────────────────────────────────────
		if (!Platform.isMobile) {
			new Setting(containerEl)
				.setName('Path options')
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

		// ── Link options ─────────────────────────────────────────────────
		new Setting(containerEl)
			.setName('Link options')
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
			.setName('Show markdown link option')
			.setDesc('Display the markdown link copy option in menus')
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
				.setDesc('Choose the format for markdown links')
				.addDropdown(dropdown => dropdown
					.addOption('wiki-style', 'Wiki-style - [[filename]]')
					.addOption('standard-markdown', 'Standard markdown - [filename](path)')
					.setValue(this.plugin.settings.markdownLinkFormat)
					.onChange(async (value) => {
						this.plugin.settings.markdownLinkFormat = value as PathCopySettings['markdownLinkFormat'];
						await this.plugin.saveSettings();
					}));
		}

		// ── Filename options ─────────────────────────────────────────────
		new Setting(containerEl)
			.setName('Filename options')
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

		// Add support links at the bottom
		containerEl.createEl('br');
		containerEl.createEl('br');
		
		const footerDiv = containerEl.createEl('div', { 
			cls: 'setting-item-description',
			attr: { style: 'text-align: center; opacity: 0.8;' }
		});
		
		// Get version from manifest
		const manifestVersion = this.plugin.manifest.version || '1.0.0';
		footerDiv.createEl('span', { text: `Version ${manifestVersion} | ` });
		
		// Helper function to create robust external links
		const createExternalLink = (text: string, url: string) => {
			const link = footerDiv.createEl('a', { text: text, href: url });
			link.onclick = (event) => {
				event.preventDefault();
				window.open(url);
			};
			return link;
		};
		
		createExternalLink('GitHub', 'https://github.com/ckelsoe/obsidian-shell-path-copy');
		footerDiv.createEl('span', { text: ' | ' });
		createExternalLink('Report Issues', 'https://github.com/ckelsoe/obsidian-shell-path-copy/issues');
	}
}
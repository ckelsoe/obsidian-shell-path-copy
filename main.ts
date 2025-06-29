import { App, Menu, Notice, Plugin, PluginSettingTab, Setting, TAbstractFile, Platform } from 'obsidian';

interface PathCopySettings {
	pathWrapping: 'none' | 'double-quotes' | 'single-quotes' | 'backticks';
	showNotifications: boolean;
	menuDisplay: 'both' | 'windows' | 'linux-mac';
	showAbsolutePath: boolean;
}

const DEFAULT_SETTINGS: PathCopySettings = {
	pathWrapping: 'backticks',
	showNotifications: true,
	menuDisplay: 'both',
	showAbsolutePath: true
}

export default class ShellPathCopyPlugin extends Plugin {
	settings: PathCopySettings;

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
			this.addCommand({
				id: 'copy-absolute-path',
				name: 'Copy as absolute path',
				callback: () => {
					const file = this.getActiveOrFocusedFile();
					if (file) {
						this.copyAbsolutePath(file);
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
			menu.addItem((item) => {
				item
					.setTitle('Copy Absolute Path')
					.setIcon('link')
					.setSection('shell-path-copy')
					.onClick(async () => {
						await this.copyAbsolutePath(file);
					});
			});
		}
	}

	async copyPath(file: TAbstractFile, format: 'unix' | 'windows') {
		try {
			if (!navigator.clipboard) {
				throw new Error('Clipboard API not available.');
			}

			// Get the vault-relative path
			let path = file.path;

			// Convert path format
			if (format === 'windows') {
				// Replace forward slashes with backslashes
				path = path.replace(/\//g, '\\');
				// Add leading backslash
				if (path && !path.startsWith('\\')) {
					path = '\\' + path;
				}
			} else {
				// Ensure paths start with forward slash
				if (path && !path.startsWith('/')) {
					path = '/' + path;
				}
			}

			// Handle vault root (empty path)
			if (!file.path) {
				path = format === 'windows' ? '\\' : '/';
			}

			// Apply wrapping
			const wrappedPath = this.wrapPath(path);

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
			// Get the absolute system path
			const absolutePath = (this.app.vault.adapter as any).getFullRealPath(file.path);
			
			// Apply wrapping
			const wrappedPath = this.wrapPath(absolutePath);

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

	private wrapPath(path: string): string {
		switch (this.settings.pathWrapping) {
			case 'double-quotes':
				return `"${path}"`;
			case 'single-quotes':
				return `'${path}'`;
			case 'backticks':
				return `\`${path}\``;
			case 'none':
			default:
				return path;
		}
	}

	private getActiveFile(): TAbstractFile | null {
		// Get the active file from the workspace
		const activeFile = this.app.workspace.getActiveFile();
		return activeFile;
	}

	private getFocusedFileInExplorer(): TAbstractFile | null {
		// Try to find the focused file in the file explorer
		// This searches for the focused element in the file explorer pane
		const fileExplorer = this.app.workspace.getLeavesOfType('file-explorer')[0];
		if (!fileExplorer) return null;

		// Look for the focused element with the is-focused class
		const focusedEl = fileExplorer.view.containerEl.querySelector('.nav-file.is-focused, .nav-folder.is-focused');
		if (!focusedEl) return null;

		// Extract the path from the data-path attribute
		const path = focusedEl.getAttribute('data-path');
		if (!path) return null;

		// Get the file/folder from the path
		return this.app.vault.getAbstractFileByPath(path);
	}

	private getActiveOrFocusedFile(): TAbstractFile | null {
		// First try to get the active file
		let file = this.getActiveFile();
		
		// If no active file, try to get the focused file in explorer
		if (!file) {
			file = this.getFocusedFileInExplorer();
		}
		
		if (!file) {
			new Notice('No file selected');
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

		// Plugin info header
		containerEl.createEl('h2', { text: 'Shell Path Copy' });
		containerEl.createEl('p', { 
			text: 'Copy file and folder paths with shell-friendly formatting for Linux and Windows.',
			cls: 'setting-item-description'
		});
		
		// Links
		const linksDiv = containerEl.createEl('div', { cls: 'setting-item-description' });
		
		// Helper function to create robust external links
		const createExternalLink = (text: string, url: string) => {
			const link = linksDiv.createEl('a', { text: text, href: url });
			link.onclick = (event) => {
				event.preventDefault();
				window.open(url);
			};
			return link;
		};

		createExternalLink('GitHub Repository', 'https://github.com/ckelsoe/obsidian-shell-path-copy');
		
		linksDiv.createEl('span', { text: ' | ' });
		
		createExternalLink('Report Issues & Feature Requests', 'https://github.com/ckelsoe/obsidian-shell-path-copy/issues');
		
		// Get version from manifest
		const manifestVersion = (this.plugin.manifest as any).version || '1.0.0';
		linksDiv.createEl('span', { text: ` | Version ${manifestVersion}` });
		
		// Add some spacing
		containerEl.createEl('br');
		containerEl.createEl('br');
		
		containerEl.createEl('h3', { text: 'Settings' });

		// Path format examples
		containerEl.createEl('div', { 
			text: 'Path Format Examples:',
			cls: 'setting-item-heading'
		});
		const examplesDiv = containerEl.createEl('div', { cls: 'setting-item-description' });
		examplesDiv.createEl('div', { text: '• Linux/Mac: /folder/subfolder/file.md' });
		examplesDiv.createEl('div', { text: '• Windows: \\folder\\subfolder\\file.md' });
		examplesDiv.createEl('div', { text: '• Absolute: C:\\Users\\name\\vault\\folder\\file.md (Windows) or /home/user/vault/folder/file.md (Linux/Mac)' });
		
		containerEl.createEl('br');

		// Path wrapping setting
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

		// Menu display setting
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

		// Show absolute path setting (only on desktop)
		if (!Platform.isMobile) {
			new Setting(containerEl)
				.setName('Show absolute path option')
				.setDesc('Display the absolute path copy option in menus (Desktop only)')
				.addToggle(toggle => toggle
					.setValue(this.plugin.settings.showAbsolutePath)
					.onChange(async (value) => {
						this.plugin.settings.showAbsolutePath = value;
						await this.plugin.saveSettings();
						new Notice('Please reload Obsidian for command palette changes to take effect');
					}));
		}

		// Notifications setting
		new Setting(containerEl)
			.setName('Show notifications')
			.setDesc('Display a notification when a path is copied')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.showNotifications)
				.onChange(async (value) => {
					this.plugin.settings.showNotifications = value;
					await this.plugin.saveSettings();
				}));
	}
}
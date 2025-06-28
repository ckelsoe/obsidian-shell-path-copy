import { App, Menu, Notice, Plugin, PluginSettingTab, Setting, TAbstractFile } from 'obsidian';

interface PathCopySettings {
	pathWrapping: 'none' | 'double-quotes' | 'single-quotes' | 'backticks';
	showNotifications: boolean;
	menuDisplay: 'both' | 'current-os';
}

const DEFAULT_SETTINGS: PathCopySettings = {
	pathWrapping: 'backticks',
	showNotifications: true,
	menuDisplay: 'both'
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

	private addPathCopyMenuItems(menu: Menu, file: TAbstractFile) {
		// Determine which OS we're on
		const isWindows = process.platform === 'win32';
		const showBoth = this.settings.menuDisplay === 'both';

		// Add section for path copy options
		menu.addSeparator();

		// Add relative path options
		if (showBoth || !isWindows) {
			menu.addItem((item) => {
				item
					.setTitle('Copy Relative Linux Path')
					.setIcon('terminal')
					.setSection('shell-path-copy')
					.onClick(async () => {
						await this.copyPath(file, 'linux', false);
					});
			});
		}

		if (showBoth || isWindows) {
			menu.addItem((item) => {
				item
					.setTitle('Copy Relative Windows Path')
					.setIcon('folder-closed')
					.setSection('shell-path-copy')
					.onClick(async () => {
						await this.copyPath(file, 'windows', false);
					});
			});
		}

		// Add absolute path options
		if (showBoth || !isWindows) {
			menu.addItem((item) => {
				item
					.setTitle('Copy Absolute Linux Path')
					.setIcon('link')
					.setSection('shell-path-copy')
					.onClick(async () => {
						await this.copyPath(file, 'linux', true);
					});
			});
		}

		if (showBoth || isWindows) {
			menu.addItem((item) => {
				item
					.setTitle('Copy Absolute Windows Path')
					.setIcon('link-2')
					.setSection('shell-path-copy')
					.onClick(async () => {
						await this.copyPath(file, 'windows', true);
					});
			});
		}
	}

	private async copyPath(file: TAbstractFile, format: 'linux' | 'windows', absolute: boolean) {
		try {
			let path: string;
			
			if (absolute) {
				// Get the absolute system path
				path = (this.app.vault.adapter as any).getFullRealPath(file.path);
			} else {
				// Get the vault-relative path
				path = file.path;
			}

			// Convert path format
			if (format === 'windows') {
				// Replace forward slashes with backslashes
				path = path.replace(/\//g, '\\');
				// Add leading backslash only for relative paths
				if (!absolute && path && !path.startsWith('\\')) {
					path = '\\' + path;
				}
			} else {
				// For Linux format
				if (!absolute) {
					// Ensure relative paths start with forward slash
					if (path && !path.startsWith('/')) {
						path = '/' + path;
					}
				}
				// Absolute Linux paths already have correct format
			}

			// Handle vault root (empty path) for relative paths
			if (!absolute && !file.path) {
				path = format === 'windows' ? '\\' : '/';
			}

			// Apply wrapping
			const wrappedPath = this.wrapPath(path);

			// Copy to clipboard
			await navigator.clipboard.writeText(wrappedPath);

			// Show notification if enabled
			if (this.settings.showNotifications) {
				const formatName = format === 'linux' ? 'Linux' : 'Windows';
				new Notice(`${formatName} path copied!`);
			}
		} catch (error) {
			console.error('Failed to copy path:', error);
			new Notice('Failed to copy path to clipboard');
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
		linksDiv.createEl('a', {
			text: 'GitHub Repository',
			href: 'https://github.com/ckelsoe/obsidian-shell-path-copy'
		});
		
		linksDiv.createEl('span', { text: ' | ' });
		
		linksDiv.createEl('a', {
			text: 'Report Issues & Feature Requests',
			href: 'https://github.com/ckelsoe/obsidian-shell-path-copy/issues'
		});
		
		linksDiv.createEl('span', { text: ' | Version 1.0.0' });
		
		// Add some spacing
		containerEl.createEl('br');
		containerEl.createEl('br');
		
		containerEl.createEl('h3', { text: 'Settings' });

		// Path wrapping setting
		new Setting(containerEl)
			.setName('Path wrapping')
			.setDesc('Choose how paths are wrapped when copied to clipboard')
			.addDropdown(dropdown => dropdown
				.addOption('none', 'None')
				.addOption('double-quotes', 'Double quotes ("path")')
				.addOption('single-quotes', 'Single quotes (\'path\')')
				.addOption('backticks', 'Backticks (`path`)')
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
				.addOption('both', 'Show both OS formats')
				.addOption('current-os', 'Show only current OS format')
				.setValue(this.plugin.settings.menuDisplay)
				.onChange(async (value) => {
					this.plugin.settings.menuDisplay = value as PathCopySettings['menuDisplay'];
					await this.plugin.saveSettings();
				}));

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
import { App, Notice, PluginSettingTab, Setting, SettingPage, SettingDefinitionItem, TextAreaComponent, Platform, setIcon } from 'obsidian';
import { PathWrapping } from './path-utils';
import { applyTemplate, validateTemplate, listTokens, templateSupportsFolders, TokenContext } from './token-engine';
import { CustomFormat, generateFormatId } from './seed-utils';
import { SelectIconModal } from './select-icon-modal';
import type ShellPathCopyPlugin from './main';

const RELOAD_NOTICE = 'Please reload Obsidian for command palette and ribbon changes to take effect';

// Curated set of menu-relevant icons offered in the per-format icon picker.
const ICON_CHOICES: string[] = [
	'clipboard-copy', 'clipboard', 'copy', 'file', 'file-text', 'file-code',
	'files', 'folder', 'folder-closed', 'link', 'link-2', 'globe', 'terminal',
	'hash', 'book', 'bookmark', 'external-link', 'list'
];

export class ShellPathCopySettingTab extends PluginSettingTab {
	plugin: ShellPathCopyPlugin;

	constructor(app: App, plugin: ShellPathCopyPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	getSettingDefinitions(): SettingDefinitionItem[] {
		return [
			{
				type: 'group',
				heading: 'Output',
				items: [
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
					}
				]
			},
			{
				type: 'group',
				heading: 'Menu behavior',
				items: [
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
					}
				]
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

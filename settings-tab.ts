import {
	App,
	Notice,
	PluginSettingTab,
	Setting,
	SettingPage,
	SettingDefinitionItem,
	SettingDefinitionList,
	TextAreaComponent,
	Platform,
	setIcon,
} from 'obsidian';
import { PathWrapping } from './path-utils';
import {
	applyTemplate,
	validateTemplate,
	listTokens,
	templateSupportsFolders,
	TokenContext,
} from './token-engine';
import { CustomFormat, generateFormatId } from './seed-utils';
import { SelectIconModal } from './select-icon-modal';
import type ShellPathCopyPlugin from './main';

const RELOAD_NOTICE =
	'Please reload Obsidian for command palette and ribbon changes to take effect';

// Community discussion for this plugin. This must stay a never-expiring
// discord.gg invite. A discord.com/channels/... deep link only resolves for
// accounts already in the server, so it cannot get anyone in, and a default
// invite expires after 7 days and would rot in a shipped release.
const DISCORD_URL = 'https://discord.gg/gd6tKJDPj4';

// Curated set of menu-relevant icons offered in the per-format icon picker.
const ICON_CHOICES: string[] = [
	'clipboard-copy',
	'clipboard',
	'copy',
	'file',
	'file-text',
	'file-code',
	'files',
	'folder',
	'folder-closed',
	'link',
	'link-2',
	'globe',
	'terminal',
	'hash',
	'book',
	'bookmark',
	'external-link',
	'list',
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
						control: { type: 'toggle', key: 'showNotifications' },
					},
					{
						name: 'Markdown link format',
						desc: 'Format used by the <markdown-link> token',
						control: {
							type: 'dropdown',
							key: 'markdownLinkFormat',
							options: {
								'wiki-style': 'Wiki-style - [[filename]]',
								'standard-markdown':
									'Standard Markdown - [filename](path)',
							},
						},
					},
					{
						name: 'Notify when a token could not be resolved',
						desc: 'Show a notice when a desktop-only or editor-only token is left blank',
						control: {
							type: 'toggle',
							key: 'warnOnUnresolvedTokens',
						},
					},
				],
			},
			{
				type: 'group',
				heading: 'Menu behavior',
				items: [
					{
						name: 'Group formats under a submenu',
						desc: "Show every format inside the plugin's own 'copy path as' submenu. Works alongside the setting below: with both on, a format appears in both submenus.",
						control: { type: 'toggle', key: 'useSubmenu' },
					},
					{
						name: "Group with Obsidian's copy path",
						desc: "Show every format inside Obsidian's native copy path submenu, alongside built-in entries like 'as Obsidian URL' and 'from vault folder'.",
						control: {
							type: 'toggle',
							key: 'groupWithNativeCopyPath',
						},
					},
					{
						// Rendered, not a bare name/desc pair: Obsidian drops a
						// definition that has no control, action, or render, so a
						// description-only row never reaches the DOM.
						name: '',
						searchable: false,
						render: (setting: Setting) => {
							const el = setting.settingEl;
							el.empty();
							el.addClass('shell-path-copy-note-row');
							el.createDiv({
								cls: 'shell-path-copy-info-note',
								text: 'With both off, every format sits at the top level of the right-click menu. Individual formats can also be pinned to the root from their own page, whichever grouping is on.',
							});
						},
					},
				],
			},
			{
				// Formats get their own section rather than sitting under "menu
				// behavior": a format feeds the right-click menu, the command palette,
				// and the ribbon, so it is not a menu setting.
				type: 'group',
				heading: 'Custom formats',
				items: [
					{
						// A navigable entry rather than an inline list: the formats live
						// one level down, and the entry carries a live count so the state
						// is readable without opening the page.
						type: 'page',
						name: 'Manage formats',
						desc: 'Templates that turn a file into a copyable path, link, or command. Each one can appear in the right-click menu, the command palette, and the ribbon.',
						displayValue: () => this.describeFormatCount(),
						items: [
							this.buildFormatList(true),
							this.buildFormatList(false),
						],
					},
					{
						// Ordering lives on its own page because these rows are plain
						// name/desc definitions, not navigable ones, which is what makes
						// Obsidian give them a real drag handle. A row that navigates
						// into a sub-page gets a chevron instead and cannot have both.
						type: 'page',
						name: 'Format order',
						desc: 'Set the order enabled formats appear in the right-click menu, the ribbon, and the command palette.',
						displayValue: () => this.describeOrderCount(),
						items: [this.buildOrderList()],
					},
				],
			},
			{
				name: '',
				searchable: false,
				render: (setting: Setting) => {
					this.renderFooter(setting);
				},
			},
		];
	}

	// Binds declarative control definitions to the plugin's own settings store,
	// so a change persists through saveSettings() and stays consistent with the
	// live settings the menu, command palette, and ribbon read.
	getControlValue(key: string): unknown {
		return (this.plugin.settings as unknown as Record<string, unknown>)[
			key
		];
	}

	async setControlValue(key: string, value: unknown): Promise<void> {
		(this.plugin.settings as unknown as Record<string, unknown>)[key] =
			value;
		await this.plugin.saveSettings();
		// Re-evaluate visible and disabled predicates in place. The grouping
		// toggles are independent of each other now, but a format page's root
		// placement still reads them, so keep the DOM state in step.
		this.refreshDomState();
	}

	// Renders the version + links footer into a trailing settings row.
	private renderFooter(setting: Setting): void {
		const el = setting.settingEl;
		el.empty();
		el.addClass('shell-path-copy-footer');

		// Everything goes in one inner container. settingEl is a flex row, and a
		// flex item drops the whitespace at its own edges, which is what collapsed
		// the separators into "GitHub|Report issues". Spacing is a gap now, so it
		// no longer depends on text nodes surviving layout.
		const inner = el.createDiv({ cls: 'shell-path-copy-footer-inner' });

		const manifestVersion = this.plugin.manifest.version || '1.0.0';
		inner.createSpan({ text: `Version ${manifestVersion}` });

		const createExternalLink = (text: string, url: string) => {
			inner.createSpan({
				cls: 'shell-path-copy-footer-separator',
				text: '|',
			});
			return inner.createEl('a', {
				text: text,
				href: url,
				attr: { target: '_blank', rel: 'noopener' },
			});
		};

		createExternalLink(
			'GitHub',
			'https://github.com/ckelsoe/obsidian-shell-path-copy',
		);
		createExternalLink('Discord', DISCORD_URL);
		createExternalLink(
			'Report issues',
			'https://github.com/ckelsoe/obsidian-shell-path-copy/issues',
		);
	}

	// Positions within customFormats of the formats in one enablement group,
	// in array order. The lists below are filtered views, so every index the
	// list hands back has to be mapped through this before touching the array.
	private formatIndexes(enabled: boolean): number[] {
		const indexes: number[] = [];
		this.plugin.settings.customFormats.forEach((fmt, index) => {
			if (Boolean(fmt.enabled) === enabled) {
				indexes.push(index);
			}
		});
		return indexes;
	}

	// Shared by both reorder surfaces: the grouped list on "manage formats" and
	// the drag list on "format order". Both are filtered views, so the indices
	// they report are positions within a group, not the real array.
	private reorderFormats(
		enabled: boolean,
		oldIndex: number,
		newIndex: number,
	): void {
		const group = this.formatIndexes(enabled);
		const from = group[oldIndex];
		const to = group[newIndex];
		if (from === undefined || to === undefined) {
			return;
		}
		this.moveFormat(from, to);
		void this.plugin.saveSettings();
		new Notice(RELOAD_NOTICE);
		this.update();
	}

	// One list per enablement state, so active formats read at a glance instead
	// of being interleaved with parked ones. The disabled list hides itself when
	// empty rather than showing a bare heading.
	private buildFormatList(enabled: boolean): SettingDefinitionList {
		const formats = this.plugin.settings.customFormats;
		const list: SettingDefinitionList = {
			type: 'list',
			heading: enabled ? 'Enabled' : 'Disabled',
			cls: enabled
				? 'shell-path-copy-formats-enabled'
				: 'shell-path-copy-formats-disabled',
			visible: () => enabled || this.formatIndexes(false).length > 0,
			onReorder: (oldIndex: number, newIndex: number) =>
				this.reorderFormats(enabled, oldIndex, newIndex),
			onDelete: (index: number) => {
				const target = this.formatIndexes(enabled)[index];
				if (target === undefined) {
					return;
				}
				formats.splice(target, 1);
				void this.plugin.saveSettings();
				new Notice(RELOAD_NOTICE);
				this.update();
			},
			items: this.formatIndexes(enabled).map((index) => {
				// index comes from formatIndexes() over this same array, so it is valid.
				const fmt = formats[index]!;
				return {
					type: 'page' as const,
					name: fmt.name || 'Untitled format',
					desc: fmt.template || '(empty template)',
					page: () => new FormatEditorPage(this, fmt),
				};
			}),
		};

		if (enabled) {
			list.emptyState =
				'No custom formats yet. Add one to create a copy action.';
			list.addItem = {
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
						appliesTo: 'both',
					};
					formats.push(created);
					void this.plugin.saveSettings();
					new Notice(RELOAD_NOTICE);
					this.update();
				},
			};
		}

		return list;
	}

	// The drag-to-reorder list. Rows carry name and description only: an item
	// with no control, action, or render is exactly the case Obsidian decorates
	// with a drag handle when the list declares onReorder. Disabled formats are
	// left out because order only matters for the surfaces they appear on.
	private buildOrderList(): SettingDefinitionList {
		const formats = this.plugin.settings.customFormats;
		return {
			type: 'list',
			cls: 'shell-path-copy-formats-order',
			emptyState:
				'No enabled formats to order. Enable one under "manage formats" first.',
			onReorder: (oldIndex: number, newIndex: number) =>
				this.reorderFormats(true, oldIndex, newIndex),
			items: this.formatIndexes(true).map((index) => {
				// index comes from formatIndexes() over this same array, so it is valid.
				const fmt = formats[index]!;
				return {
					name: fmt.name || 'Untitled format',
					desc: fmt.template || '(empty template)',
				};
			}),
		};
	}

	// Summary shown on the "format order" entry.
	private describeOrderCount(): string {
		const enabled = this.formatIndexes(true).length;
		return enabled === 1 ? '1 format' : `${enabled} formats`;
	}

	// Summary shown on the "custom formats" entry, so the count is readable
	// without opening the page. Re-evaluated on every update().
	private describeFormatCount(): string {
		const formats = this.plugin.settings.customFormats;
		if (formats.length === 0) {
			return 'None';
		}
		const enabled = formats.filter((fmt) => fmt.enabled).length;
		return enabled === formats.length
			? `${enabled} enabled`
			: `${enabled} of ${formats.length} enabled`;
	}

	// Moves a format within the list (drag-drop reorder).
	private moveFormat(from: number, to: number): void {
		const list = this.plugin.settings.customFormats;
		if (from < 0 || to < 0 || from >= list.length || to >= list.length) {
			return;
		}
		const [moved] = list.splice(from, 1);
		if (moved === undefined) {
			return;
		}
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

	// Edits here change the parent list, not just this page: enablement decides
	// which group the format sits in and feeds both summary counts, and the name
	// and template are the row's own text. Rebuild the tab's definitions on the
	// way out. closePage() calls hide() before re-displaying the parent, so the
	// parent renders from the refreshed tree rather than a stale snapshot.
	hide(): void {
		super.hide();
		this.tab.update();
	}

	display(): void {
		const fmt = this.fmt;
		const editor = this.containerEl;
		editor.empty();
		let previewEl: HTMLElement;
		let infoEl: HTMLElement;

		new Setting(editor)
			.setName('Enabled')
			.setDesc(
				'Turn this format on or off everywhere (menu, command palette, ribbon)',
			)
			.addToggle((toggle) =>
				toggle.setValue(fmt.enabled).onChange(async (value) => {
					fmt.enabled = value;
					await this.plugin.saveSettings();
					new Notice(RELOAD_NOTICE);
				}),
			);

		new Setting(editor).setName('Name').addText((text) =>
			text.setValue(fmt.name).onChange(async (value) => {
				fmt.name = value;
				// Keep the page title in sync; the list entry relabels on the
				// next tab render (when the user navigates back).
				this.title = value || 'Untitled format';
				await this.plugin.saveSettings();
			}),
		);

		const iconSetting = new Setting(editor)
			.setName('Icon')
			.setDesc(
				'Icon shown next to this format in the menu, command palette, and ribbon. Pick a common one or browse the full set.',
			);

		// Render the icon itself next to its name. The name alone says nothing
		// about what lands in the menu, and an icon picked from the full browser
		// is not in the curated dropdown at all.
		const iconPreview = iconSetting.controlEl.createDiv({
			cls: 'shell-path-copy-format-icon-preview',
		});
		const paintIconPreview = () => {
			iconPreview.empty();
			setIcon(iconPreview, fmt.icon);
			iconPreview.setAttr('aria-label', fmt.icon);
		};
		paintIconPreview();

		iconSetting
			.addDropdown((dropdown) => {
				// A format can carry any icon from the full browser, so seed the list
				// with the stored one when it falls outside the curated set. Without
				// this the dropdown silently reads "clipboard-copy" for those formats.
				const choices = ICON_CHOICES.includes(fmt.icon)
					? ICON_CHOICES
					: [fmt.icon, ...ICON_CHOICES];
				for (const icon of choices) {
					dropdown.addOption(icon, icon);
				}
				dropdown.setValue(fmt.icon);
				dropdown.onChange(async (value) => {
					fmt.icon = value;
					paintIconPreview();
					await this.plugin.saveSettings();
				});
			})
			.addButton((button) =>
				button.setButtonText('Browse all icons').onClick(() => {
					new SelectIconModal(this.tab.app, fmt.icon, (chosen) => {
						fmt.icon = chosen;
						void this.plugin.saveSettings();
						// Rebuild so the dropdown and the preview both pick up the
						// choice, including an icon from outside the curated set.
						this.display();
					}).open();
				}),
			);

		// Refreshes the "Show on" control in place. Assigned where the control is
		// built below; invoked when the template changes so the files/folders choice
		// tracks whether the current template still supports folders.
		let refreshShowOn = (): void => {};

		let templateRef: TextAreaComponent;
		new Setting(editor)
			.setName('Template')
			.setDesc(
				'Use tokens like <filename>. Click a token below to insert it at the cursor.',
			)
			.addTextArea((text) => {
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
		const palette = editor.createDiv({
			cls: 'shell-path-copy-token-palette',
		});
		for (const token of listTokens()) {
			let tip = '';
			if (token.tier === 'desktop') {
				tip = ' (desktop only)';
			} else if (token.tier === 'editor') {
				tip = ' (editor only)';
			}
			const button = palette.createEl('button', {
				cls: 'shell-path-copy-token-button',
				text: `<${token.name}>`,
				attr: { title: `${token.description}${tip}` },
			});
			button.addEventListener('click', () => {
				const input = templateRef.inputEl;
				const insert = `<${token.name}>`;
				const start = input.selectionStart;
				const end = input.selectionEnd;
				const next =
					input.value.slice(0, start) +
					insert +
					input.value.slice(end);
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

		previewEl = editor.createDiv({
			cls: 'shell-path-copy-template-preview',
		});
		infoEl = editor.createDiv({ cls: 'shell-path-copy-format-info' });
		this.renderPreview(previewEl, infoEl, fmt.template);

		new Setting(editor)
			.setName('Wrapping')
			.setDesc('Wrap the rendered result (useful for paths with spaces)')
			.addDropdown((dropdown) =>
				dropdown
					.addOption('none', 'None')
					.addOption('double-quotes', 'Double quotes')
					.addOption('single-quotes', 'Single quotes')
					.addOption('backticks', 'Backticks')
					.setValue(fmt.wrapping)
					.onChange(async (value) => {
						fmt.wrapping = value as PathWrapping;
						this.renderPreview(previewEl, infoEl, fmt.template);
						await this.plugin.saveSettings();
					}),
			);

		new Setting(editor)
			.setName('Show in right-click menu')
			.setDesc(this.describeMenuPlacement())
			.addToggle((toggle) =>
				toggle.setValue(fmt.showInMenu).onChange(async (value) => {
					fmt.showInMenu = value;
					await this.plugin.saveSettings();
					// Rebuild so the root-menu toggle below updates its state.
					this.display();
				}),
			);

		new Setting(editor)
			.setName('Show in root menu')
			.setDesc(this.describeRootPlacement(fmt))
			.addToggle((toggle) =>
				toggle
					.setValue(fmt.pinToRoot)
					.setDisabled(
						!fmt.showInMenu || !this.rootPlacementApplies(),
					)
					.onChange(async (value) => {
						fmt.pinToRoot = value;
						await this.plugin.saveSettings();
					}),
			);

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
					.setDesc(
						'Limit this format to files, folders, or show it on both.',
					)
					.addDropdown((dropdown) =>
						dropdown
							.addOption('both', 'Files and folders')
							.addOption('files', 'Files only')
							.addOption('folders', 'Folders only')
							.setValue(fmt.appliesTo)
							.onChange(async (value) => {
								fmt.appliesTo =
									value as CustomFormat['appliesTo'];
								await this.plugin.saveSettings();
							}),
					);
			} else {
				showOn
					.setDesc(
						'Files only. This format uses file-specific tokens (like <obsidian-url>) that do not apply to folders.',
					)
					.addDropdown((dropdown) =>
						dropdown
							.addOption('files', 'Files only')
							.setValue('files')
							.setDisabled(true),
					);
			}
		};
		refreshShowOn();

		new Setting(editor)
			.setName('Show in command palette')
			.setDesc('Register this format as a command')
			.addToggle((toggle) =>
				toggle.setValue(fmt.showInCommands).onChange(async (value) => {
					fmt.showInCommands = value;
					await this.plugin.saveSettings();
					new Notice(RELOAD_NOTICE);
				}),
			);

		new Setting(editor)
			.setName('Show in ribbon')
			.setDesc('Add a left-ribbon icon that copies this format')
			.addToggle((toggle) =>
				toggle.setValue(fmt.showInRibbon).onChange(async (value) => {
					fmt.showInRibbon = value;
					await this.plugin.saveSettings();
					new Notice(RELOAD_NOTICE);
				}),
			);
	}

	// A fixed sample file used to render the live template preview. Reflects the
	// host platform so the preview matches what the user will actually get.
	// Where a menu-enabled format lands depends on two workspace-level settings,
	// and the destinations are additive, so the description names every place it
	// will actually appear. Turning this off removes the format from every
	// right-click menu; it does not move it into Obsidian's copy path submenu.
	private describeMenuPlacement(): string {
		const settings = this.plugin.settings;
		const tail = 'Off leaves it in the command palette and ribbon only.';
		if (settings.groupWithNativeCopyPath && settings.useSubmenu) {
			return `Show this format in the right-click menu, inside both Obsidian's copy path submenu and the plugin's 'copy path as' submenu. ${tail}`;
		}
		if (settings.groupWithNativeCopyPath) {
			return `Show this format in the right-click menu, inside Obsidian's own copy path submenu. ${tail}`;
		}
		if (settings.useSubmenu) {
			return `Show this format in the right-click menu, inside the plugin's 'copy path as' submenu. ${tail}`;
		}
		return `Show this format in the right-click menu, at the top level. ${tail}`;
	}

	// Root placement is additive on top of whichever submenu the format lands in.
	// It only stops meaning anything when neither grouping is on, because then
	// every format is already at the root.
	private rootPlacementApplies(): boolean {
		return (
			this.plugin.settings.groupWithNativeCopyPath ||
			this.plugin.settings.useSubmenu
		);
	}

	private describeRootPlacement(fmt: CustomFormat): string {
		if (!fmt.showInMenu) {
			return 'Turn on "show in right-click menu" first.';
		}
		if (!this.rootPlacementApplies()) {
			return 'Every format already sits at the menu root, because neither grouping option is on.';
		}
		return 'Also show this format at the top level of the right-click menu, on top of the submenu it appears in.';
	}

	private sampleContext(): TokenContext {
		const isWindows = Platform.isWin;
		const desktopPath = isWindows
			? 'C:\\Users\\name\\assorted\\Notes\\My file.md'
			: '/home/name/assorted/Notes/My file.md';
		return {
			fileName: 'My file.md',
			filePath: 'Notes/My file.md',
			isFolder: false,
			vaultName: 'assorted',
			isWindows,
			absolutePath: Platform.isMobile ? null : desktopPath,
			lineNumber: 42,
			selectionStartLine: 42,
			selectionEndLine: 58,
			currentHeading: 'My heading',
			blockId: 'a1b2c3',
			markdownLinkFormat: this.plugin.settings.markdownLinkFormat,
			now: new Date(),
		};
	}

	// Renders one Desktop/Mobile support row item with a check or cross icon.
	private renderCompatItem(
		parent: HTMLElement,
		label: string,
		ok: boolean,
	): void {
		const item = parent.createSpan({ cls: 'shell-path-copy-compat-item' });
		const mark = item.createSpan({
			cls: ok
				? 'shell-path-copy-compat-ok'
				: 'shell-path-copy-compat-bad',
		});
		setIcon(mark, ok ? 'check' : 'x');
		item.createSpan({ text: label });
	}

	// Renders the live preview line, the Desktop/Mobile support row, and any
	// notes about tokens that will not resolve everywhere.
	private renderPreview(
		previewEl: HTMLElement,
		infoEl: HTMLElement,
		template: string,
	): void {
		previewEl.empty();
		infoEl.empty();

		if (template.trim() === '') {
			previewEl.setText('Preview: (empty template)');
			return;
		}

		const applied = applyTemplate(template, this.sampleContext());
		previewEl.setText(`Preview: ${applied.text}`);

		const issues = validateTemplate(template);
		const desktopOnly = issues.filter(
			(i) => i.kind === 'desktop-only-token',
		);
		const editorOnly = issues.filter((i) => i.kind === 'editor-only-token');
		const unknown = issues.filter((i) => i.kind === 'unknown-token');

		// Desktop/Mobile support. Everything works on desktop; mobile fails only
		// when the template uses a desktop-only token.
		const compat = infoEl.createDiv({ cls: 'shell-path-copy-compat' });
		this.renderCompatItem(compat, 'Desktop', true);
		this.renderCompatItem(compat, 'Mobile', desktopOnly.length === 0);

		for (const issue of desktopOnly) {
			infoEl.createDiv({
				cls: 'shell-path-copy-info-note',
				text: issue.detail,
			});
		}
		if (editorOnly.length > 0) {
			infoEl.createDiv({
				cls: 'shell-path-copy-info-note',
				text: 'The line number fills in only when this file is open in the editor.',
			});
		}
		for (const issue of unknown) {
			infoEl.createDiv({
				cls: 'shell-path-copy-badge-warn',
				text: issue.detail,
			});
		}
	}
}

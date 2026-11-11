// Obsidian's settings search finds a setting by its name, description and
// aliases. A section drawn by hand has none of those unless it is given them,
// so every one of them except the footer must carry a name and be searchable.

import type { App } from 'obsidian';
import type ShellPathCopyPlugin from '../main';
import { ShellPathCopySettingTab } from '../settings-tab';

// The real `obsidian` package is types only; the tab needs base classes to load.
vi.mock('obsidian', () => ({
	PluginSettingTab: class {
		constructor(public app: unknown) {}
	},
	SettingPage: class {},
	Modal: class {},
}));

interface Item {
	type?: string;
	name?: string;
	desc?: unknown;
	aliases?: string[];
	searchable?: boolean | (() => boolean);
	render?: unknown;
	items?: Item[];
}

function leaves(items: Item[]): Item[] {
	return items.flatMap((i) => (i.items ? leaves(i.items) : [i]));
}

// Obsidian treats an absent `searchable` as true and also accepts a callback.
function isSearchable(i: Item): boolean {
	return typeof i.searchable === 'function'
		? i.searchable()
		: i.searchable !== false;
}

describe('settings search', () => {
	const plugin = {
		settings: { customFormats: [] },
	} as unknown as ShellPathCopyPlugin;
	const tab = new ShellPathCopySettingTab({} as App, plugin);
	const items = leaves(tab.getSettingDefinitions());
	const custom = items.filter((i) => i.render !== undefined && !i.type);

	it('gives every hand-drawn section a name and makes it searchable, except the footer', () => {
		const hidden = custom.filter((i) => !isSearchable(i));
		expect(hidden).toHaveLength(1);
		const searchable = custom.filter(isSearchable);
		expect(searchable.length).toBeGreaterThan(0);
		for (const i of searchable) {
			expect(typeof i.name).toBe('string');
			expect(i.name).not.toBe('');
			expect(typeof i.desc).toBe('string');
			expect(i.aliases?.length).toBeGreaterThan(0);
		}
	});

	it('finds the menu placement note by the words people type', () => {
		const note = items.find((i) => i.name === 'Top-level menu placement');
		expect(note?.aliases).toContain('root menu');
		expect(note?.desc).toContain('top level of the right-click menu');
	});
});

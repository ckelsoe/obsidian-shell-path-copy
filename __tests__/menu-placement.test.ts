import { pickRootFormats } from '../menu-utils';
import { CustomFormat } from '../seed-utils';

// These tests will FAIL until Charles implements pickRootFormats in
// menu-utils.ts. The failures pinpoint the four rules the helper must satisfy.

function makeFormat(overrides: Partial<CustomFormat>): CustomFormat {
	return {
		id: overrides.id ?? 'id-' + Math.random().toString(36).slice(2, 10),
		name: overrides.name ?? 'Test format',
		template: '<filename>',
		wrapping: 'none',
		icon: 'clipboard-copy',
		enabled: true,
		showInMenu: true,
		showInCommands: true,
		pinToRoot: false,
		...overrides,
	};
}

describe('pickRootFormats', () => {
	it('returns every visible format when useSubmenu is false (flat fallback)', () => {
		const formats = [
			makeFormat({ name: 'A', pinToRoot: false }),
			makeFormat({ name: 'B', pinToRoot: true }),
			makeFormat({ name: 'C', pinToRoot: false }),
		];
		expect(pickRootFormats(formats, false)).toEqual(formats);
	});

	it('returns an empty array when useSubmenu is true and nothing is pinned', () => {
		const formats = [
			makeFormat({ name: 'A', pinToRoot: false }),
			makeFormat({ name: 'B', pinToRoot: false }),
		];
		expect(pickRootFormats(formats, true)).toEqual([]);
	});

	it('returns only pinned formats when useSubmenu is true, preserving input order', () => {
		const a = makeFormat({ name: 'A', pinToRoot: true });
		const b = makeFormat({ name: 'B', pinToRoot: false });
		const c = makeFormat({ name: 'C', pinToRoot: true });
		expect(pickRootFormats([a, b, c], true)).toEqual([a, c]);
	});

	it('returns an empty array for an empty input (submenu on)', () => {
		expect(pickRootFormats([], true)).toEqual([]);
	});

	it('returns an empty array for an empty input (submenu off)', () => {
		expect(pickRootFormats([], false)).toEqual([]);
	});
});

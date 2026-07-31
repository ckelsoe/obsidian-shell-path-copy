import { pickRootFormats, matchesTarget } from '../menu-utils';
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
		showInRibbon: false,
		pinToRoot: false,
		appliesTo: 'both',
		...overrides,
	};
}

describe('pickRootFormats', () => {
	it('returns every visible format when neither container is on (flat fallback)', () => {
		const formats = [
			makeFormat({ name: 'A', pinToRoot: false }),
			makeFormat({ name: 'B', pinToRoot: true }),
			makeFormat({ name: 'C', pinToRoot: false }),
		];
		expect(pickRootFormats(formats, false, false)).toEqual(formats);
	});

	it('returns an empty array when the submenu is on and nothing is pinned', () => {
		const formats = [
			makeFormat({ name: 'A', pinToRoot: false }),
			makeFormat({ name: 'B', pinToRoot: false }),
		];
		expect(pickRootFormats(formats, true, false)).toEqual([]);
	});

	it('returns only pinned formats when the submenu is on, preserving input order', () => {
		const a = makeFormat({ name: 'A', pinToRoot: true });
		const b = makeFormat({ name: 'B', pinToRoot: false });
		const c = makeFormat({ name: 'C', pinToRoot: true });
		expect(pickRootFormats([a, b, c], true, false)).toEqual([a, c]);
	});

	// Native grouping no longer swallows root placement: a pinned format shows at
	// the root as well as inside Obsidian's copy path submenu.
	it('returns pinned formats when only native grouping is on', () => {
		const a = makeFormat({ name: 'A', pinToRoot: true });
		const b = makeFormat({ name: 'B', pinToRoot: false });
		expect(pickRootFormats([a, b], false, true)).toEqual([a]);
	});

	it('returns an empty array when only native grouping is on and nothing is pinned', () => {
		const formats = [makeFormat({ name: 'A' }), makeFormat({ name: 'B' })];
		expect(pickRootFormats(formats, false, true)).toEqual([]);
	});

	it('returns pinned formats when both containers are on', () => {
		const a = makeFormat({ name: 'A', pinToRoot: false });
		const b = makeFormat({ name: 'B', pinToRoot: true });
		expect(pickRootFormats([a, b], true, true)).toEqual([b]);
	});

	it('returns an empty array for an empty input (submenu on)', () => {
		expect(pickRootFormats([], true, false)).toEqual([]);
	});

	it('returns an empty array for an empty input (nothing on)', () => {
		expect(pickRootFormats([], false, false)).toEqual([]);
	});
});

describe('matchesTarget', () => {
	describe('file context (isFolder=false)', () => {
		it('shows a both-format', () => {
			expect(matchesTarget(makeFormat({ appliesTo: 'both' }), false)).toBe(true);
		});
		it('shows a files-only format', () => {
			expect(matchesTarget(makeFormat({ appliesTo: 'files' }), false)).toBe(true);
		});
		it('hides a folders-only format', () => {
			expect(matchesTarget(makeFormat({ appliesTo: 'folders' }), false)).toBe(false);
		});
		it('shows a file-only-token format regardless of appliesTo', () => {
			expect(matchesTarget(makeFormat({ template: '<obsidian-url>', appliesTo: 'both' }), false)).toBe(true);
		});
	});

	describe('folder context (isFolder=true)', () => {
		it('shows a folder-safe both-format', () => {
			expect(matchesTarget(makeFormat({ template: '<relative-path>', appliesTo: 'both' }), true)).toBe(true);
		});
		it('shows a folder-safe folders-only format', () => {
			expect(matchesTarget(makeFormat({ template: '<filename>', appliesTo: 'folders' }), true)).toBe(true);
		});
		it('hides a folder-safe files-only format', () => {
			expect(matchesTarget(makeFormat({ template: '<filename>', appliesTo: 'files' }), true)).toBe(false);
		});
		it('hides a file-only-token format even when appliesTo is both (capability gate)', () => {
			expect(matchesTarget(makeFormat({ template: '<obsidian-url>', appliesTo: 'both' }), true)).toBe(false);
		});
		it('hides a file-only-token format even when appliesTo is folders', () => {
			expect(matchesTarget(makeFormat({ template: '<wikilink>', appliesTo: 'folders' }), true)).toBe(false);
		});
		it('hides a format mixing folder-safe and file-only tokens', () => {
			expect(matchesTarget(makeFormat({ template: '<filename> <line-number>', appliesTo: 'both' }), true)).toBe(false);
		});
	});
});

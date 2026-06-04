import {
	SETTINGS_VERSION,
	seedAllFormats,
	seedFormatsForVersion,
	normalizeCustomFormats,
	CustomFormat,
} from '../seed-utils';
import { matchesTarget } from '../menu-utils';

function byName(formats: CustomFormat[], name: string): CustomFormat {
	const found = formats.find((f) => f.name === name);
	if (!found) {
		throw new Error(`seed not found: ${name}`);
	}
	return found;
}

// ─── seedAllFormats: fresh install ────────────────────────────────────────────

describe('seedAllFormats - fresh install', () => {
	const formats = seedAllFormats(null);

	it('seeds every built-in', () => {
		expect(formats.length).toBe(15);
	});

	it('enables exactly the core four', () => {
		const enabled = formats.filter((f) => f.enabled).map((f) => f.name).sort();
		expect(enabled).toEqual(
			['Markdown link', 'Obsidian URL', 'Relative Linux/macOS path', 'Relative Windows path'].sort()
		);
	});

	it('disables the examples and the heading/block links', () => {
		expect(byName(formats, 'Example: line reference').enabled).toBe(false);
		expect(byName(formats, 'Obsidian URL (to heading)').enabled).toBe(false);
		expect(byName(formats, 'Wiki link (to block)').enabled).toBe(false);
	});

	it('defaults path formats to backtick wrapping', () => {
		expect(byName(formats, 'Relative Linux/macOS path').wrapping).toBe('backticks');
		expect(byName(formats, 'Obsidian URL').wrapping).toBe('none');
	});

	it('gives every seed a unique id', () => {
		const ids = new Set(formats.map((f) => f.id));
		expect(ids.size).toBe(formats.length);
	});
});

// ─── seedAllFormats: migration from pre-1.19 ──────────────────────────────────

describe('seedAllFormats - migration', () => {
	it('carries enabled state from the legacy boolean settings', () => {
		const legacy = {
			menuDisplay: 'windows',
			showAbsolutePath: true,
			showFileUrl: false,
			showObsidianUrl: true,
			showMarkdownLink: false,
			showFilename: true,
			showFilenameWithExt: false,
		};
		const formats = seedAllFormats(legacy);
		expect(byName(formats, 'Relative Windows path').enabled).toBe(true);
		expect(byName(formats, 'Relative Linux/macOS path').enabled).toBe(false);
		expect(byName(formats, 'Absolute path').enabled).toBe(true);
		expect(byName(formats, 'file:// URL').enabled).toBe(false);
		expect(byName(formats, 'Markdown link').enabled).toBe(false);
		expect(byName(formats, 'Filename').enabled).toBe(true);
		expect(byName(formats, 'Filename with extension').enabled).toBe(false);
	});

	it('migrates the path wrapping setting onto path formats', () => {
		const formats = seedAllFormats({ pathWrapping: 'double-quotes' });
		expect(byName(formats, 'Absolute path').wrapping).toBe('double-quotes');
	});

	it('treats an absent legacy boolean as enabled', () => {
		const formats = seedAllFormats({});
		expect(byName(formats, 'Absolute path').enabled).toBe(true);
	});

	it('keeps the heading and block seeds disabled through migration', () => {
		const formats = seedAllFormats({ showObsidianUrl: true });
		expect(byName(formats, 'Obsidian URL (to heading)').enabled).toBe(false);
		expect(byName(formats, 'Obsidian URL (to block)').enabled).toBe(false);
	});
});

// ─── seedFormatsForVersion ────────────────────────────────────────────────────

describe('seedFormatsForVersion', () => {
	it('returns the two heading seeds for version 2', () => {
		const formats = seedFormatsForVersion(2);
		expect(formats.map((f) => f.name).sort()).toEqual(
			['Obsidian URL (to heading)', 'Wiki link (to heading)'].sort()
		);
		expect(formats.every((f) => !f.enabled)).toBe(true);
	});

	it('returns the two block seeds for version 3', () => {
		const formats = seedFormatsForVersion(3);
		expect(formats.map((f) => f.name).sort()).toEqual(
			['Obsidian URL (to block)', 'Wiki link (to block)'].sort()
		);
	});

	it('returns the plain-words line example for version 4', () => {
		const formats = seedFormatsForVersion(4);
		expect(formats.map((f) => f.name)).toEqual(['Example: name and line number']);
		expect(formats[0].template).toBe('<filename-ext> Line <line-number>');
		expect(formats[0].enabled).toBe(false);
	});

	it('current version is 6', () => {
		expect(SETTINGS_VERSION).toBe(6);
	});

	it('returns no new seed formats for version 5 (pinToRoot is a field add, not a seed)', () => {
		expect(seedFormatsForVersion(5)).toEqual([]);
	});

	it('returns no new seed formats for version 6 (appliesTo is a field add, not a seed)', () => {
		expect(seedFormatsForVersion(6)).toEqual([]);
	});
});

// ─── normalizeCustomFormats ───────────────────────────────────────────────────

describe('normalizeCustomFormats', () => {
	it('returns an empty array for non-array input', () => {
		expect(normalizeCustomFormats(null)).toEqual([]);
		expect(normalizeCustomFormats('nope')).toEqual([]);
	});

	it('fills missing fields with defaults', () => {
		const result = normalizeCustomFormats([{ name: 'X' }]);
		expect(result[0].name).toBe('X');
		expect(result[0].template).toBe('');
		expect(result[0].wrapping).toBe('none');
		expect(result[0].icon).toBe('clipboard-copy');
		expect(result[0].enabled).toBe(true);
		expect(typeof result[0].id).toBe('string');
	});

	it('coerces an invalid wrapping to none', () => {
		const result = normalizeCustomFormats([{ wrapping: 'bogus' }]);
		expect(result[0].wrapping).toBe('none');
	});

	it('reassigns duplicate ids', () => {
		const result = normalizeCustomFormats([
			{ id: 'dup', name: 'A' },
			{ id: 'dup', name: 'B' },
		]);
		expect(result[0].id).not.toBe(result[1].id);
	});

	it('preserves a valid format', () => {
		const result = normalizeCustomFormats([
			{ id: 'x1', name: 'Keep', template: '<filename>', wrapping: 'backticks', icon: 'file', enabled: false, showInMenu: false, showInCommands: true, showInRibbon: true, pinToRoot: true, appliesTo: 'folders' },
		]);
		expect(result[0]).toEqual({
			id: 'x1',
			name: 'Keep',
			template: '<filename>',
			wrapping: 'backticks',
			icon: 'file',
			enabled: false,
			showInMenu: false,
			showInCommands: true,
			showInRibbon: true,
			pinToRoot: true,
			appliesTo: 'folders',
		});
	});

	it('defaults pinToRoot to false when absent', () => {
		const result = normalizeCustomFormats([{ name: 'X' }]);
		expect(result[0].pinToRoot).toBe(false);
	});

	it('defaults pinToRoot to false for non-boolean values', () => {
		const result = normalizeCustomFormats([{ name: 'X', pinToRoot: 'yes' as unknown as boolean }]);
		expect(result[0].pinToRoot).toBe(false);
	});

	it('preserves pinToRoot=true', () => {
		const result = normalizeCustomFormats([{ name: 'X', pinToRoot: true }]);
		expect(result[0].pinToRoot).toBe(true);
	});

	it('defaults appliesTo to both when absent', () => {
		const result = normalizeCustomFormats([{ name: 'X' }]);
		expect(result[0].appliesTo).toBe('both');
	});

	it('defaults appliesTo to both for an invalid value', () => {
		const result = normalizeCustomFormats([{ name: 'X', appliesTo: 'everywhere' as unknown as 'both' }]);
		expect(result[0].appliesTo).toBe('both');
	});

	it('preserves a valid appliesTo', () => {
		expect(normalizeCustomFormats([{ name: 'X', appliesTo: 'files' }])[0].appliesTo).toBe('files');
		expect(normalizeCustomFormats([{ name: 'Y', appliesTo: 'folders' }])[0].appliesTo).toBe('folders');
	});
});

// ─── seedAllFormats: pinToRoot defaults ──────────────────────────────────────

describe('seedAllFormats - pinToRoot', () => {
	it('seeds every built-in with pinToRoot=false on fresh install', () => {
		const formats = seedAllFormats(null);
		expect(formats.every((f) => f.pinToRoot === false)).toBe(true);
	});

	it('seeds every built-in with pinToRoot=false on legacy migration', () => {
		const formats = seedAllFormats({ pathWrapping: 'backticks', showAbsolutePath: true });
		expect(formats.every((f) => f.pinToRoot === false)).toBe(true);
	});

	it('seeds every built-in with appliesTo=both', () => {
		expect(seedAllFormats(null).every((f) => f.appliesTo === 'both')).toBe(true);
	});

	it('keeps URL/link seeds off folders via the capability gate despite appliesTo=both', () => {
		// The Obsidian URL seed is appliesTo=both, but its <obsidian-url> token makes
		// it file-only; matchesTarget must exclude it from folders regardless.
		const obsidianUrl = seedAllFormats(null).find((f) => f.template === '<obsidian-url>');
		expect(obsidianUrl?.appliesTo).toBe('both');
		expect(matchesTarget(obsidianUrl as CustomFormat, true)).toBe(false);
		expect(matchesTarget(obsidianUrl as CustomFormat, false)).toBe(true);
	});
});

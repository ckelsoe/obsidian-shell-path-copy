import {
	resolveBlockTargetLine,
	findExistingBlockId,
	generateBlockId,
	BlockSection,
	BlockListItem,
} from '../block-utils';

function section(type: string, start: number, end: number): BlockSection {
	return { type, position: { start: { line: start }, end: { line: end } } };
}

function listItem(start: number, end: number): BlockListItem {
	return { position: { start: { line: start }, end: { line: end } } };
}

// ─── resolveBlockTargetLine ───────────────────────────────────────────────────

describe('resolveBlockTargetLine', () => {
	it('targets the end line of a paragraph at the cursor', () => {
		const sections = [section('paragraph', 2, 4)];
		expect(resolveBlockTargetLine(sections, [], 3)).toBe(4);
	});

	it('returns null for a heading', () => {
		expect(resolveBlockTargetLine([section('heading', 0, 0)], [], 0)).toBeNull();
	});

	it('returns null for a code block', () => {
		expect(resolveBlockTargetLine([section('code', 1, 5)], [], 3)).toBeNull();
	});

	it('returns null for frontmatter', () => {
		expect(resolveBlockTargetLine([section('yaml', 0, 3)], [], 1)).toBeNull();
	});

	it('returns null when the cursor is on no block', () => {
		expect(resolveBlockTargetLine([section('paragraph', 2, 4)], [], 99)).toBeNull();
	});

	it('targets the list item, not the whole list section', () => {
		const sections = [section('list', 1, 3)];
		const items = [listItem(1, 1), listItem(2, 3)];
		expect(resolveBlockTargetLine(sections, items, 2)).toBe(3);
	});

	it('targets the innermost list item when items nest', () => {
		const items = [listItem(0, 5), listItem(2, 3)];
		expect(resolveBlockTargetLine([], items, 2)).toBe(3);
	});
});

// ─── findExistingBlockId ──────────────────────────────────────────────────────

describe('findExistingBlockId', () => {
	it('reads an id at the end of a line', () => {
		expect(findExistingBlockId('Some text ^abc123')).toBe('abc123');
	});

	it('reads an id with trailing whitespace', () => {
		expect(findExistingBlockId('Some text ^id-2  ')).toBe('id-2');
	});

	it('returns null when there is no id', () => {
		expect(findExistingBlockId('Some text')).toBeNull();
	});

	it('returns null for a caret with no preceding whitespace', () => {
		expect(findExistingBlockId('nodelimiter^abc')).toBeNull();
	});
});

// ─── generateBlockId ──────────────────────────────────────────────────────────

describe('generateBlockId', () => {
	it('returns a 6-character alphanumeric id', () => {
		const id = generateBlockId({});
		expect(id).toMatch(/^[a-z0-9]{6}$/);
	});

	it('returns an id not present in the used set', () => {
		const id = generateBlockId({});
		expect(id in {}).toBe(false);
		expect(typeof id).toBe('string');
	});
});

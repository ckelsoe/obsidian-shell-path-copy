// Pure helpers for resolving the block at a cursor position. Kept free of the
// Obsidian API so it can be unit-tested; main.ts feeds it plain cache data.

/** Minimal shape of an Obsidian SectionCache / ListItemCache position. */
interface CachePosition {
	start: { line: number };
	end: { line: number };
}

export interface BlockSection {
	type?: string;
	position: CachePosition;
}

export interface BlockListItem {
	position: CachePosition;
}

/**
 * Returns the line a block id should attach to for the block at `cursorLine`,
 * or null when the cursor is not on a block that supports a same-line id.
 *
 * A list item wins over its containing section: the id attaches to the item.
 * Otherwise only plain paragraphs are supported. Headings, frontmatter, tables,
 * code blocks, callouts, and other multi-line constructs return null, and the
 * caller falls back to a file link rather than risk a misplaced marker.
 */
export function resolveBlockTargetLine(
	sections: readonly BlockSection[],
	listItems: readonly BlockListItem[],
	cursorLine: number
): number | null {
	// Innermost list item containing the cursor (the id attaches to the item).
	let item: BlockListItem | null = null;
	for (const candidate of listItems) {
		const within =
			candidate.position.start.line <= cursorLine && cursorLine <= candidate.position.end.line;
		if (within && (!item || candidate.position.start.line > item.position.start.line)) {
			item = candidate;
		}
	}
	if (item) {
		return item.position.end.line;
	}

	const section = sections.find(
		(s) => s.position.start.line <= cursorLine && cursorLine <= s.position.end.line
	);
	if (section && section.type === 'paragraph') {
		return section.position.end.line;
	}
	return null;
}

/**
 * Reads an existing block id from a line, or null. Block ids are alphanumeric
 * plus dash, preceded by whitespace, at the end of the line.
 */
export function findExistingBlockId(lineText: string): string | null {
	const match = lineText.match(/[ \t]\^([a-zA-Z0-9-]+)\s*$/);
	return match ? match[1] : null;
}

/** Generates a short block id (6 alphanumeric chars) not present in `used`. */
export function generateBlockId(used: Record<string, unknown>): string {
	let id = '';
	do {
		id = Math.random().toString(36).slice(2, 8);
	} while (id.length < 6 || id in used);
	return id;
}

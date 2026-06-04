// Pure filtering for the icon picker (no Obsidian import), unit-testable. The
// icon id list itself comes from getIconIds() at runtime; this module only filters
// and sorts what it is handed. Adapted from the developer-toolbox icon browser.

// Case-insensitive substring match on the icon id. An empty query returns the
// list unchanged so the grid shows everything by default.
export function filterIcons(ids: string[], query: string): string[] {
	const q = query.trim().toLowerCase();
	if (!q) return ids;
	return ids.filter((id) => id.toLowerCase().includes(q));
}

// Stable alphabetical order. getIconIds() returns ids in an arbitrary,
// runtime-dependent order, so sort once for predictable browsing.
export function sortIcons(ids: string[]): string[] {
	return [...ids].sort((a, b) => a.localeCompare(b));
}

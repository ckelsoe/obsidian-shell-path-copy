// Pure windowing math for a fixed-row-height virtual list. Given the scroll
// position and viewport size, returns which rows to render plus the spacer
// geometry, so a list of thousands keeps a small constant DOM node count. No DOM
// here on purpose: this is unit-tested, and the DOM wiring lives in
// virtual-list.ts. A grid is modeled as rows of N cells, so the same math drives
// the icon grid. Adapted from the developer-toolbox virtual list.

export interface VirtualWindow {
	// First row index to render, inclusive.
	firstRow: number;
	// Last row index to render, inclusive. -1 when there is nothing to render.
	lastRow: number;
	// Pixel offset of the first rendered row from the top of the full list.
	padTop: number;
	// Pixel height of the full virtual list (all rows), used to size the spacer.
	totalHeight: number;
}

export interface VirtualWindowArgs {
	scrollTop: number;
	viewportHeight: number;
	rowHeight: number;
	rowCount: number;
	// Rows rendered above and below the viewport to avoid blank edges while
	// scrolling. Defaults to 4.
	overscan?: number;
}

export function computeVirtualWindow(args: VirtualWindowArgs): VirtualWindow {
	const { rowHeight, rowCount, viewportHeight } = args;
	const overscan = Math.max(0, args.overscan ?? 4);
	const totalHeight = Math.max(0, rowCount * rowHeight);

	// Nothing to lay out: no rows, or geometry not measurable yet (a modal can
	// open with a zero-height viewport before first paint). Return an empty window
	// rather than guessing; the caller refreshes once real measurements exist.
	if (rowCount <= 0 || rowHeight <= 0 || viewportHeight <= 0) {
		return { firstRow: 0, lastRow: -1, padTop: 0, totalHeight };
	}

	const scrollTop = Math.max(0, args.scrollTop);
	const firstVisible = Math.floor(scrollTop / rowHeight);
	const lastVisible = Math.ceil((scrollTop + viewportHeight) / rowHeight) - 1;

	const firstRow = Math.max(0, firstVisible - overscan);
	const lastRow = Math.min(rowCount - 1, lastVisible + overscan);
	const padTop = firstRow * rowHeight;

	return { firstRow, lastRow, padTop, totalHeight };
}

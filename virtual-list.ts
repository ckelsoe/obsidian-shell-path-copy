import { computeVirtualWindow } from './virtual-window';

// Fixed-height virtual list. Renders only the rows in (or near) the viewport so a
// list of thousands stays at a small, constant DOM node count. The caller owns row
// content via renderRow; this owns the scroll handler and spacer geometry. The
// windowing math is the pure computeVirtualWindow.
//
// A grid is driven through the same controller by treating each grid row as one
// fixed-height row of N cells (the caller lays the cells out inside renderRow).
// Adapted from the developer-toolbox virtual list.

export interface VirtualListController {
	// Set the number of rows and repaint from the top. Call on every filter change.
	setRowCount(rowCount: number): void;
	// Recompute against the current scroll position and size. Call after a layout
	// change (for example once the modal has been measured).
	refresh(): void;
	// Detach the scroll handler and remove the injected elements.
	destroy(): void;
}

export interface VirtualListOptions {
	// Scroll container. Must have a bounded height and overflow-y: auto in CSS.
	scrollEl: HTMLElement;
	// Fixed pixel height of every row. Rows must not vary in height.
	rowHeight: number;
	// Fill rowEl with the content for rowIndex. rowEl is already height-sized.
	renderRow: (rowIndex: number, rowEl: HTMLElement) => void;
	overscan?: number;
}

export function createVirtualList(opts: VirtualListOptions): VirtualListController {
	const { scrollEl, rowHeight, renderRow } = opts;
	const overscan = opts.overscan ?? 4;

	// sizer reserves the full scroll range; rowsEl is the translated slice that
	// holds the handful of rendered rows.
	const sizer = scrollEl.createDiv({ cls: 'shell-path-copy-vlist-sizer' });
	const rowsEl = sizer.createDiv({ cls: 'shell-path-copy-vlist-rows' });

	let rowCount = 0;

	const render = (): void => {
		const win = computeVirtualWindow({
			scrollTop: scrollEl.scrollTop,
			viewportHeight: scrollEl.clientHeight,
			rowHeight,
			rowCount,
			overscan,
		});

		sizer.style.height = `${win.totalHeight}px`;
		rowsEl.style.transform = `translateY(${win.padTop}px)`;
		rowsEl.empty();

		for (let i = win.firstRow; i <= win.lastRow; i++) {
			const rowEl = rowsEl.createDiv({ cls: 'shell-path-copy-vlist-row' });
			rowEl.style.height = `${rowHeight}px`;
			renderRow(i, rowEl);
		}
	};

	const onScroll = (): void => render();
	scrollEl.addEventListener('scroll', onScroll, { passive: true });

	const scheduleMeasuredRefresh = (): void => {
		// A modal often opens with clientHeight 0 (not yet painted), which yields an
		// empty window. Repaint once the browser has laid the container out.
		const win = scrollEl.ownerDocument.defaultView;
		if (win) win.requestAnimationFrame(() => render());
	};

	return {
		setRowCount: (n: number): void => {
			rowCount = Math.max(0, n);
			scrollEl.scrollTop = 0;
			render();
			scheduleMeasuredRefresh();
		},
		refresh: render,
		destroy: (): void => {
			scrollEl.removeEventListener('scroll', onScroll);
			sizer.remove();
		},
	};
}

import { computeVirtualWindow } from '../virtual-window';

describe('computeVirtualWindow', () => {
	test('renders only the viewport plus overscan, not the whole list', () => {
		// 1000 rows of 30px, 300px viewport scrolled to the top. Visible rows are
		// 0..9; with the default overscan of 4 the window is 0..13.
		const win = computeVirtualWindow({
			scrollTop: 0,
			viewportHeight: 300,
			rowHeight: 30,
			rowCount: 1000,
		});
		expect(win.firstRow).toBe(0);
		expect(win.lastRow).toBe(13);
		expect(win.padTop).toBe(0);
		expect(win.totalHeight).toBe(30000);
	});

	test('offsets the window and padTop when scrolled into the middle', () => {
		// Scrolled 3000px: first visible row is 100, last visible is 109. Overscan 4
		// widens to 96..113, and padTop aligns to the first rendered row.
		const win = computeVirtualWindow({
			scrollTop: 3000,
			viewportHeight: 300,
			rowHeight: 30,
			rowCount: 1000,
		});
		expect(win.firstRow).toBe(96);
		expect(win.lastRow).toBe(113);
		expect(win.padTop).toBe(96 * 30);
	});

	test('clamps the last row to the end of the list', () => {
		const win = computeVirtualWindow({
			scrollTop: 29700,
			viewportHeight: 300,
			rowHeight: 30,
			rowCount: 1000,
		});
		expect(win.lastRow).toBe(999);
	});

	test('returns an empty window when there are no rows', () => {
		const win = computeVirtualWindow({
			scrollTop: 0,
			viewportHeight: 300,
			rowHeight: 30,
			rowCount: 0,
		});
		expect(win.lastRow).toBe(-1);
		expect(win.totalHeight).toBe(0);
	});

	test('returns an empty window when the viewport is not yet measured', () => {
		const win = computeVirtualWindow({
			scrollTop: 0,
			viewportHeight: 0,
			rowHeight: 30,
			rowCount: 1000,
		});
		expect(win.lastRow).toBe(-1);
		// totalHeight is still known so the spacer can reserve scroll range.
		expect(win.totalHeight).toBe(30000);
	});

	test('treats a negative scrollTop (overscroll) as the top', () => {
		const win = computeVirtualWindow({
			scrollTop: -50,
			viewportHeight: 300,
			rowHeight: 30,
			rowCount: 1000,
			overscan: 0,
		});
		expect(win.firstRow).toBe(0);
		expect(win.padTop).toBe(0);
	});
});

import { App, Modal, SearchComponent, getIconIds, setIcon } from 'obsidian';
import { createVirtualList, type VirtualListController } from './virtual-list';
import { filterIcons, sortIcons } from './icon-collect';

// Fixed grid-row height for the virtual list (preview glyph plus a two-line
// clamped id label). Each virtual row holds `columns` cells.
const ROW_HEIGHT = 88;

// Approximate cell footprint (min cell width plus gap). Columns is derived from
// the container width divided by this, so the grid reflows as the modal resizes.
const CELL_FOOTPRINT = 100;

// Browse and pick any Lucide / Obsidian icon id usable in setIcon and addRibbonIcon.
// getIconIds() and setIcon() are public obsidian exports. The grid is virtualized
// as rows of `columns` cells, so the full ~1500-icon set scrolls smoothly without a
// render cap. Clicking a cell calls onChoose(id) and closes. Adapted from the
// developer-toolbox icon browser, which copies to the clipboard instead of choosing.
export class SelectIconModal extends Modal {
	private allIds: string[];
	private current: string;
	private onChoose: (id: string) => void;
	private listEl!: HTMLElement;
	private countEl!: HTMLElement;
	private matches: string[] = [];
	private columns = 6;
	private vlist: VirtualListController | null = null;
	private resizeObserver: ResizeObserver | null = null;

	constructor(app: App, current: string, onChoose: (id: string) => void) {
		super(app);
		this.current = current;
		this.onChoose = onChoose;
		// Enumerate live and sort once. Never hardcode: the set is runtime
		// dependent (core icons plus any addIcon registrations from other plugins).
		this.allIds = sortIcons(getIconIds());
	}

	onOpen(): void {
		this.modalEl.addClass('shell-path-copy-icon-dialog');
		this.titleEl.setText('Choose an icon');

		const { contentEl } = this;
		contentEl.empty();

		const search = new SearchComponent(contentEl);
		search.setPlaceholder('Search icons by ID');
		search.inputEl.addClass('shell-path-copy-icon-search');
		search.onChange((value) => this.renderList(value));

		this.countEl = contentEl.createDiv({ cls: 'shell-path-copy-icon-count' });
		this.listEl = contentEl.createDiv({ cls: 'shell-path-copy-icon-grid' });

		this.vlist = createVirtualList({
			scrollEl: this.listEl,
			rowHeight: ROW_HEIGHT,
			renderRow: (index, rowEl) => this.renderRow(index, rowEl),
		});

		// Recompute columns and row count whenever the grid's width changes (modal
		// resize, window resize). Observing also fires once with the initial size,
		// which corrects the column count after first layout.
		this.resizeObserver = new ResizeObserver(() => this.relayout());
		this.resizeObserver.observe(this.listEl);

		this.renderList('');
	}

	onClose(): void {
		this.resizeObserver?.disconnect();
		this.resizeObserver = null;
		this.vlist?.destroy();
		this.vlist = null;
		this.contentEl.empty();
	}

	private renderList(query: string): void {
		this.matches = filterIcons(this.allIds, query);
		this.countEl.setText(`${this.matches.length} icons`);
		this.relayout();
	}

	// Map the current match count onto grid rows for the active column count.
	private relayout(): void {
		this.columns = this.computeColumns();
		const rowCount = Math.ceil(this.matches.length / this.columns);
		this.vlist?.setRowCount(rowCount);
	}

	private computeColumns(): number {
		const width = this.listEl?.clientWidth ?? 0;
		// Before first layout the width is 0; keep the last known column count so
		// the grid is not briefly single-column. The ResizeObserver corrects it.
		if (width <= 0) return this.columns;
		return Math.max(1, Math.floor(width / CELL_FOOTPRINT));
	}

	private renderRow(rowIndex: number, rowEl: HTMLElement): void {
		rowEl.addClass('shell-path-copy-icon-row');
		const start = rowIndex * this.columns;
		for (let c = 0; c < this.columns; c++) {
			const idx = start + c;
			if (idx >= this.matches.length) {
				// Pad the trailing slots so the real cells keep their width.
				rowEl.createDiv({ cls: 'shell-path-copy-icon-cell-spacer' });
				continue;
			}
			const id = this.matches[idx];
			if (id === undefined) continue;
			const cell = rowEl.createDiv({
				cls: 'shell-path-copy-icon-cell',
				attr: { 'aria-label': `Choose ${id}`, title: id },
			});
			if (id === this.current) {
				cell.addClass('is-selected');
			}
			const preview = cell.createDiv({ cls: 'shell-path-copy-icon-preview' });
			setIcon(preview, id);
			cell.createSpan({ cls: 'shell-path-copy-icon-label', text: id });
			cell.addEventListener('click', () => {
				this.onChoose(id);
				this.close();
			});
		}
	}
}

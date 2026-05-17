import { PathWrapping } from './path-utils';

// Custom-format model, the seeded built-in formats, and the migration helpers
// that produce them. Kept free of the Obsidian API so it can be unit-tested.

// Settings schema version. Bumped when a one-time migration is needed.
//   1: token engine; built-ins seeded as custom formats.
//   2: heading-aware link seeds added.
//   3: block-aware link seeds added.
//   4: plain-words line reference example seed added.
export const SETTINGS_VERSION = 4;

// A user-defined copy format. Each entry produces its own context-menu item and
// command-palette command via the token engine. The built-ins ship as seeded
// CustomFormat entries; there is no separate built-in code path.
export interface CustomFormat {
	id: string;            // stable unique id, used for command ids
	name: string;
	template: string;
	wrapping: PathWrapping; // applied around the rendered result
	icon: string;          // Lucide icon name shown in the menu
	enabled: boolean;
	showInMenu: boolean;
	showInCommands: boolean;
}

export const VALID_WRAPPINGS: PathWrapping[] = ['none', 'double-quotes', 'single-quotes', 'backticks'];

// Specification for a seeded built-in format. `legacyKey` maps to the pre-1.19
// boolean setting (or 'unix'/'windows' for the menuDisplay-governed paths) so
// migration can carry the user's prior choices forward. `sinceVersion` is the
// settings version that introduced the seed, for incremental migration.
interface SeedSpec {
	name: string;
	template: string;
	icon: string;
	wrapMode: 'path' | 'filename' | 'plain';
	core: boolean;        // enabled by default on a fresh install
	legacyKey: string;
	sinceVersion: number;
}

const BUILTIN_SEEDS: SeedSpec[] = [
	{ name: 'Relative Linux/macOS path', template: '<relative-path-unix>', icon: 'terminal', wrapMode: 'path', core: true, legacyKey: 'unix', sinceVersion: 1 },
	{ name: 'Relative Windows path', template: '<relative-path-windows>', icon: 'folder-closed', wrapMode: 'path', core: true, legacyKey: 'windows', sinceVersion: 1 },
	{ name: 'Absolute path', template: '<absolute-path>', icon: 'folder-closed', wrapMode: 'path', core: false, legacyKey: 'showAbsolutePath', sinceVersion: 1 },
	{ name: 'file:// URL', template: '<file-url>', icon: 'globe', wrapMode: 'plain', core: false, legacyKey: 'showFileUrl', sinceVersion: 1 },
	{ name: 'Obsidian URL', template: '<obsidian-url>', icon: 'link-2', wrapMode: 'plain', core: true, legacyKey: 'showObsidianUrl', sinceVersion: 1 },
	{ name: 'Markdown link', template: '<markdown-link>', icon: 'link', wrapMode: 'plain', core: true, legacyKey: 'showMarkdownLink', sinceVersion: 1 },
	{ name: 'Filename', template: '<filename>', icon: 'file-text', wrapMode: 'filename', core: false, legacyKey: 'showFilename', sinceVersion: 1 },
	{ name: 'Filename with extension', template: '<filename-ext>', icon: 'file', wrapMode: 'filename', core: false, legacyKey: 'showFilenameWithExt', sinceVersion: 1 },
	// Example formats from issue 13. Seeded disabled as starting points.
	{ name: 'Example: name and Obsidian URL', template: '<filename> -> <obsidian-url>', icon: 'link-2', wrapMode: 'plain', core: false, legacyKey: '', sinceVersion: 1 },
	{ name: 'Example: line reference', template: '<filename-ext>#L<line-number>', icon: 'hash', wrapMode: 'plain', core: false, legacyKey: '', sinceVersion: 1 },
	{ name: 'Example: name and line number', template: '<filename-ext> Line <line-number>', icon: 'hash', wrapMode: 'plain', core: false, legacyKey: '', sinceVersion: 4 },
	// Heading-aware links: jump to the cursor's heading, or the file if none.
	{ name: 'Obsidian URL (to heading)', template: '<obsidian-url-heading>', icon: 'link-2', wrapMode: 'plain', core: false, legacyKey: '', sinceVersion: 2 },
	{ name: 'Wiki link (to heading)', template: '<wikilink-heading>', icon: 'hash', wrapMode: 'plain', core: false, legacyKey: '', sinceVersion: 2 },
	// Block-aware links: jump to the cursor's block, creating a block id if needed.
	{ name: 'Obsidian URL (to block)', template: '<obsidian-url-block>', icon: 'link-2', wrapMode: 'plain', core: false, legacyKey: '', sinceVersion: 3 },
	{ name: 'Wiki link (to block)', template: '<wikilink-block>', icon: 'hash', wrapMode: 'plain', core: false, legacyKey: '', sinceVersion: 3 }
];

// Generates a stable id for a custom format. Prefers crypto.randomUUID (available
// in Obsidian's Electron and modern mobile runtimes); falls back to a timestamp +
// random suffix where it is not.
export function generateFormatId(): string {
	if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
		return crypto.randomUUID();
	}
	return `fmt-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e9).toString(36)}`;
}

// Builds one CustomFormat from a seed spec. With no legacy data (fresh install)
// the core set is enabled with default wrapping. With legacy data, enabled state
// and wrapping are migrated from the pre-1.19 boolean settings so existing users
// keep exactly what they had.
function makeSeed(spec: SeedSpec, legacy: Record<string, unknown> | null): CustomFormat {
	const oldWrap: PathWrapping = legacy && VALID_WRAPPINGS.includes(legacy.pathWrapping as PathWrapping)
		? (legacy.pathWrapping as PathWrapping)
		: 'backticks';
	const menuDisplay = legacy ? legacy.menuDisplay : undefined;
	const filenameWrap = legacy ? legacy.filenameUseWrapping === true : false;

	let enabled: boolean;
	if (!legacy || spec.legacyKey === '') {
		// Fresh install, or a seed with no pre-1.19 equivalent.
		enabled = spec.core;
	} else if (spec.legacyKey === 'unix') {
		enabled = menuDisplay !== 'windows';
	} else if (spec.legacyKey === 'windows') {
		enabled = menuDisplay !== 'linux-mac';
	} else {
		// Pre-1.19 show* booleans defaulted to true; absent counts as enabled.
		enabled = legacy[spec.legacyKey] !== false;
	}

	let wrapping: PathWrapping = 'none';
	if (spec.wrapMode === 'path') {
		wrapping = legacy ? oldWrap : 'backticks';
	} else if (spec.wrapMode === 'filename') {
		wrapping = legacy && filenameWrap ? oldWrap : 'none';
	}

	return {
		id: generateFormatId(),
		name: spec.name,
		template: spec.template,
		wrapping,
		icon: spec.icon,
		enabled,
		showInMenu: true,
		showInCommands: true
	};
}

// All seeded formats, for a fresh install or a pre-1.19 upgrade.
export function seedAllFormats(legacy: Record<string, unknown> | null): CustomFormat[] {
	return BUILTIN_SEEDS.map((spec) => makeSeed(spec, legacy));
}

// Seeds introduced in a specific settings version, for incremental migration.
// These are always new (no legacy mapping), so they use fresh-install defaults.
export function seedFormatsForVersion(version: number): CustomFormat[] {
	return BUILTIN_SEEDS.filter((spec) => spec.sinceVersion === version).map((spec) => makeSeed(spec, null));
}

// Coerces possibly-corrupt or hand-edited persisted data into a valid CustomFormat
// array. Missing fields fall back to safe defaults; duplicate ids are reassigned.
export function normalizeCustomFormats(value: unknown): CustomFormat[] {
	if (!Array.isArray(value)) {
		return [];
	}
	const seenIds = new Set<string>();
	return value.map((raw): CustomFormat => {
		const item = (raw ?? {}) as Partial<CustomFormat>;
		const wrapping = VALID_WRAPPINGS.includes(item.wrapping as PathWrapping)
			? (item.wrapping as PathWrapping)
			: 'none';
		let id = typeof item.id === 'string' && item.id ? item.id : generateFormatId();
		while (seenIds.has(id)) {
			id = generateFormatId();
		}
		seenIds.add(id);
		return {
			id,
			name: typeof item.name === 'string' ? item.name : 'Custom format',
			template: typeof item.template === 'string' ? item.template : '',
			wrapping,
			icon: typeof item.icon === 'string' && item.icon ? item.icon : 'clipboard-copy',
			enabled: item.enabled !== false,
			showInMenu: item.showInMenu !== false,
			showInCommands: item.showInCommands !== false
		};
	});
}

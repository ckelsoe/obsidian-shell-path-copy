import { CustomFormat } from './seed-utils';
import { templateSupportsFolders } from './token-engine';

// Pure decision: which visible formats render at the *root* of the context menu.
// Visible formats are always added to the submenu when the submenu is enabled;
// this helper only decides the extra copy that also appears at the top level.
// Submenu off → flat fallback (everything to root). Submenu on → only pinned.
export function pickRootFormats(
	visible: CustomFormat[],
	useSubmenu: boolean,
): CustomFormat[] {
	if (!useSubmenu) {
		return [...visible];
	}
	return visible.filter((fmt) => fmt.pinToRoot);
}

// Pure decision: does this format apply in the given file/folder context?
// Combines the user's preference (appliesTo) with a hard capability gate: a
// format whose template uses file-only tokens (obsidian-url, wikilinks, editor
// tokens, ...) never applies to a folder, regardless of appliesTo, because those
// tokens do not resolve meaningfully for folders. Mirrors Obsidian's own native
// menu, which omits URL copy on folders.
export function matchesTarget(fmt: CustomFormat, isFolder: boolean): boolean {
	if (!isFolder) {
		return fmt.appliesTo !== 'folders';
	}
	if (!templateSupportsFolders(fmt.template)) {
		return false;
	}
	return fmt.appliesTo !== 'files';
}

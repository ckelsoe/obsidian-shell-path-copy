import { CustomFormat } from './seed-utils';
import { templateSupportsFolders } from './token-engine';

// Pure decision: which visible formats render at the *root* of the context menu.
// Placement is additive. A format lands in every container that is switched on
// (Obsidian's copy path submenu, the plugin's own submenu, or both), and a
// pinned format appears at the root on top of that. When neither container is
// on there is nowhere else to put them, so every visible format falls back to
// the root and pinning is redundant.
export function pickRootFormats(
	visible: CustomFormat[],
	useSubmenu: boolean,
	groupWithNativeCopyPath: boolean,
): CustomFormat[] {
	if (!useSubmenu && !groupWithNativeCopyPath) {
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

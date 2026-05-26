import { CustomFormat } from './seed-utils';

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

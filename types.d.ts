import 'obsidian';

declare module 'obsidian' {
	interface PluginManifest {
		version: string;
	}
	// setSubmenu is present in the Obsidian runtime since 1.6 but is not part
	// of the public obsidian.d.ts. minAppVersion in manifest.json is later than
	// 1.6, so calling this is safe; the augmentation keeps the call type-checked
	// without an `as any` cast. Using an
	// inline import for the return type avoids ESLint's no-undef on the bare
	// 'Menu' identifier inside the module-augmentation block.
	interface MenuItem {
		setSubmenu(): import('obsidian').Menu;
	}
}

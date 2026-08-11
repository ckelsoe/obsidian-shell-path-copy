import tseslint from "typescript-eslint";
import obsidianmd from "eslint-plugin-obsidianmd";
import sonarjs from "eslint-plugin-sonarjs";
import prettierConfig from "eslint-config-prettier";
import globals from "globals";
import { globalIgnores } from "eslint/config";

export default tseslint.config(
	{
		languageOptions: {
			globals: {
				...globals.browser,
				...globals.node,
			},
			parserOptions: {
				projectService: {
					allowDefaultProject: ["eslint.config.mts", "manifest.json"],
				},
				tsconfigRootDir: import.meta.dirname,
				extraFileExtensions: [".json"],
			},
		},
	},
	// Type-aware baseline: recommended + the type-checked family (no-unsafe-*,
	// no-floating-promises, no-misused-promises, await-thenable, no-base-to-string,
	// etc.). Obsidian plugins are heavily async and traffic in untyped host
	// globals; these catch unsafe-any and unhandled-promise bugs.
	...tseslint.configs.recommendedTypeChecked,
	...obsidianmd.configs.recommended,
	{
		files: ["**/*.ts"],
		plugins: { sonarjs },
		rules: {
			"@typescript-eslint/require-await": "error",
			// eslint-plugin-sonarjs: a curated BUG-detection allowlist, not the
			// full recommended preset (whose style/metric rules are noise at
			// scale). Every rule here flags a genuine logic defect. Two rules are
			// intentionally excluded: no-async-constructor (false-positives on the
			// Obsidian fluent-component pattern) and no-duplicated-branches (a
			// duplication smell that floods on exhaustive dispatch switches).
			"sonarjs/no-all-duplicated-branches": "error",
			"sonarjs/no-identical-conditions": "error",
			"sonarjs/no-identical-expressions": "error",
			"sonarjs/no-identical-functions": "error",
			"sonarjs/no-gratuitous-expressions": "error",
			"sonarjs/no-redundant-assignments": "error",
			"sonarjs/no-redundant-boolean": "error",
			"sonarjs/no-element-overwrite": "error",
			"sonarjs/no-collection-size-mischeck": "error",
			"sonarjs/no-empty-collection": "error",
			"sonarjs/no-unused-collection": "error",
			"sonarjs/no-use-of-empty-return-value": "error",
			"sonarjs/no-ignored-return": "error",
			"sonarjs/different-types-comparison": "error",
			"sonarjs/super-linear-regex": "error",
			"sonarjs/no-inverted-boolean-check": "error",
			"sonarjs/for-loop-increment-sign": "error",
			"sonarjs/duplicates-in-character-class": "error",
			"sonarjs/no-duplicate-in-composite": "error",
		},
	},
	{
		files: ["__tests__/**/*.ts"],
		languageOptions: {
			globals: {
				...globals.jest,
			},
		},
		rules: {
			// Tests are not shipped or marketplace-scanned; fixtures and mocks
			// legitimately traffic in `any`.
			"@typescript-eslint/no-unsafe-assignment": "off",
			"@typescript-eslint/no-unsafe-call": "off",
			"@typescript-eslint/no-unsafe-member-access": "off",
			"@typescript-eslint/no-unsafe-argument": "off",
			"@typescript-eslint/no-unsafe-return": "off",
			"@typescript-eslint/unbound-method": "off",
		},
	},
	globalIgnores([
		"node_modules",
		"dist",
		".stryker-tmp",
		"main.js",
		"scripts",
		"esbuild.config.mjs",
		"stryker.config.mjs",
		"version-bump.mjs",
		"versions.json",
		"package.json",
		"package-lock.json",
		"tsconfig.json",
		"tsconfig.scan.json",
		"scan-node-shim.d.ts",
		"jest.config.js",
		"eslint.config.mts",
	]),
	// Last, so it wins: disables every stylistic rule Prettier owns.
	prettierConfig,
);

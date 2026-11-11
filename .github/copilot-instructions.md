# Copilot instructions for obsidian-shell-path-copy

## What this repository is

An [Obsidian](https://obsidian.md) community plugin (TypeScript, esbuild bundle) that copies file and folder paths to the clipboard in shell-friendly formats. It works on desktop and mobile (`isDesktopOnly` is false).

Key facts for a reviewer:

- Every copy action is a `CustomFormat` (`seed-utils.ts`): a token template plus wrapping, icon and placement flags. The built-ins ship as seeded `CustomFormat` entries. There is no separate built-in code path.
- `token-engine.ts` renders templates (`applyTemplate`, `validateTemplate`, `listTokens`). It, `path-utils.ts`, `seed-utils.ts`, `block-utils.ts` and `menu-utils.ts` do not import `obsidian`, so they stay unit-testable.
- `main.ts` builds the token context, registers one command and one optional ribbon icon per enabled format, and fills the right-click menu. `settings-tab.ts` holds the settings UI.
- The right-click submenu uses `MenuItem.setSubmenu()`, declared in `types.d.ts` because it is missing from the public typings.
- The plugin is read-only, with one exception: a block token writes a `^id` marker into the open note through `editor.setLine` in `resolveBlockId`.

## Build, lint, test

```bash
npm run build   # tsc type-check + esbuild bundle
npm run lint    # eslint (zero warnings), prettier --check, submission pre-check, marketplace type-check
npm test        # Vitest
```

All three must pass. `npm run knip`, `npm run type-coverage` (at least 99%) and `npm run test:mutation` (Stryker) are extra checks.

## Hard rules

- Never `eslint-disable` an `obsidianmd/*` rule. Any other allowed disable carries a `-- reason`.
- No `as any`. No non-null assertions (`x!`). Tests use `at()` from `__tests__/helpers/checked.ts`. Missing Obsidian types go in `types.d.ts`.
- No regex lookbehind (`(?<=`, `(?<!`). It stops the plugin loading on iOS before 16.4.
- No bare `moment` imported from `obsidian`. Use `Date` or `Intl`.
- No `!important` in `styles.css`, no inline styles, no `innerHTML` or `outerHTML` writes, no `document.createElement`.
- Use popout-safe DOM: `activeDocument`, `activeWindow`, or the element's own document. Not the global `document` or `window`.
- No top-level import of Node built-ins. Load them only through a platform-guarded `require()`, as `getNodePath()` in `main.ts` does.
- No internal Obsidian APIs where a public one exists. Absolute paths come from `FileSystemAdapter.getBasePath()` plus `path.join()`.
- UI strings in sentence case. No "command" in command ids or names. Settings headings never contain "settings", "options", "general" or the plugin name.
- No em dashes in prose or comments.
- Never remove, skip or weaken a test to make CI pass.

## Plugin-specific pitfalls

- Every value read from `data.json` is validated. New `CustomFormat` fields need a safe default in `normalizeCustomFormats`.
- A settings change that needs a migration bumps `SETTINGS_VERSION` and adds a line to its comment. New seeds get a `sinceVersion` so `seedFormatsForVersion` appends them to existing vaults without touching user formats.
- Format ids are stable. Command ids are `custom-format-<id>`, so changing an id breaks user hotkeys.
- Desktop-only tokens (`<absolute-path>`, `<file-url>`) resolve to null on mobile or a non-`FileSystemAdapter` vault. They must render blank, never throw.
- Editor-only tokens (line, heading, block) fill in only when the copied file is the one open in the editor.
- Block links cover paragraphs and list items only. On a heading, table, code block or with no editor, fall back to a file link and write nothing.
- Read an existing block id from the line text, not the metadata cache. The cache can be stale right after an insert.
- A file-only token keeps a format off folders whatever `appliesTo` says (`templateSupportsFolders`).
- Commands and ribbon icons register once at load. Changes to them need a reload; menu changes do not.
- README is public: no CI or release internals, no links to private repos.

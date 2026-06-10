# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [2.7.1] - 2026-06-10

### Changed
- Internal restructuring, no behavior change:
  - The settings tab and format editor page moved from `main.ts` to a new `settings-tab.ts`. `main.ts` drops from 822 to 391 lines and now holds only the plugin lifecycle, menus, commands, ribbon, and copy flow.
  - `buildMarkdownLink` reuses `formatRelativePath` instead of re-implementing the `./` prefix logic.
  - tsconfig `lib` extended to ES2017/ES2018 to match the code and the esbuild target; `include` lists `**/*.d.ts` explicitly.
- Test quality: replaced a tautological block-id collision assertion (`id in {}`) with a growing used-set check plus a rigged-RNG retry test, and the universal-tier section-token test now asserts the rendered text, not only the metadata flag.

## [2.7.0] - 2026-06-05

### Changed
- Settings reorganized into grouped sections. The global options are now split into an "Output" group (notifications, Markdown link format, unresolved-token notice) and a "Menu behavior" group (submenu grouping, group with Obsidian's copy path). The custom formats list is unchanged. Grouping only; no setting moved store or changed behavior.

## [2.6.0] - 2026-06-04

### Changed
- Requires Obsidian 1.13.0 or later. Obsidian keeps serving 2.5.0 to vaults on older versions, so nothing breaks for them.
- Settings migrated to Obsidian's declarative settings API. The global options are now indexed in Obsidian's settings search, and each custom format opens its own settings sub-page with an add/reorder/delete list. A format's enabled toggle now lives on its sub-page.
- Cleared the Obsidian 1.13.0 API deprecations (`PluginSettingTab.display`, `setWarning`).

## [2.5.0] - 2026-06-04

### Added
- Per-format ribbon icons. Each custom format has a "Show in ribbon" toggle in its settings editor; when on, it adds a left-ribbon icon that copies that format from the active note in one click. Off by default. Ribbon icons register in the same order as the format list.
- "Browse all icons" button in the format icon picker. The existing dropdown still offers common icons; the button opens a searchable grid of every Obsidian icon so a format can use any icon for its menu, command, and ribbon entries.

## [2.4.2] - 2026-05-30

### Changed
- When copying a custom format fails, the error notice now shows the actual error message instead of telling you to open the developer console.

## [2.4.1] - 2026-05-29

### Fixed
- The "Show on" control in a format's settings editor now updates as you edit the
  template. Previously it read folder support once when the editor opened, so a
  format edited into a file-only one (for example by adding `<obsidian-url>`) kept
  showing the full files/folders/both dropdown instead of locking to "Files only".
  The right-click menu behavior was already correct; this fixes only the stale
  settings control.

## [2.4.0] - 2026-05-29

### Added
- Per-format "Show on" preference: limit a format to files, folders, or both. The
  control appears when expanding a format in settings. Formats whose template uses
  file-specific tokens (such as `<obsidian-url>`, wiki links, or editor tokens like
  `<line-number>`) are automatically files-only, since those tokens do not resolve
  for folders. This mirrors how Obsidian's own menu omits URL copy on folders.

### Changed
- Custom-format commands now use a conditional callback. A command no longer shows
  in the command palette when there is no active note, or when the format does not
  apply to the current target (for example a folders-only format). Previously the
  command always showed and displayed a "No file selected" notice when run with no
  active note.

## [2.3.0] - 2026-05-27

### Added
- "Group with Obsidian's copy path" setting (off by default). When on, every
  enabled custom format is appended into Obsidian's native **Copy path**
  submenu alongside built-in entries like *as Obsidian URL* and *from vault
  folder*, instead of living inside the plugin's own **Copy path as** submenu.
  Uses the public `MenuItem.setSection` API with section id `info.copy`; no
  internal Obsidian APIs are touched.

## [2.2.1] - 2026-05-26

### Changed
- Release workflow now appends VirusTotal scan analysis links to the GitHub
  release body (`update_release_body: true`) and runs the VirusTotal step
  after release creation. The scans had been running on every release but the
  result links were not visible in the release notes. No plugin behavior
  change.

## [2.2.0] - 2026-05-26

### Added
- "Copy path as" submenu groups every custom format under a single right-click
  menu entry, decluttering the file/folder and in-document context menus
  ([#15](https://github.com/ckelsoe/obsidian-shell-path-copy/issues/15)).
- Per-format "Pin to root menu" toggle keeps favorite formats accessible at the
  top level while still showing them inside the submenu.
- Global "Group formats under a submenu" toggle in settings (on by default) to
  opt back into the flat layout.

### Changed
- `minAppVersion` raised from `1.5.0` to `1.6.0` so the menu-submenu API can be
  used directly (no runtime feature detection).
- Settings schema version bumped from `4` to `5`; the new `pinToRoot` field
  defaults to `false` on existing custom formats on first load.

## [2.1.0] - 2026-05-18

### Added
- Selection tokens `<line-start>`, `<line-end>`, and `<line-range>` for the first
  and last line of the editor selection. `<line-range>` copies `42-58` for a
  multi-line selection and a single number when nothing is selected. With no
  selection all three fall back to the cursor line. Useful for building a file
  plus line-range reference such as `<absolute-path>#L<line-range>` to hand to an
  AI coding agent. See `token-usage.md`. (issue #13)

## [2.0.0] - 2026-05-17

A major version: the plugin is rewritten around a token engine. The fixed
built-in formats are gone, the settings schema changed, and the minimum
Obsidian version was raised. Existing 1.18.x settings migrate automatically.

### Added
- Custom formats: define your own copy formats as token templates. Each format
  becomes its own right-click menu item and command-palette command, with its
  own name, icon, wrapping, and visibility. Add as many as you want.
- A token engine with tokens covering filename and extension, vault-relative and
  absolute paths, `file://` and Obsidian URLs, Markdown and wiki links, heading
  and block links, line number, date, and time. See `token-usage.md`.
- Heading-aware and block-aware link formats that link to the heading or block
  the cursor is in, or the file when there is none.
- Copy formats now appear in the in-document right-click menu, not only the
  file explorer.
- Settings: a compact, drag-to-reorder format list (up and down buttons on
  mobile) with an expand-to-edit panel, a clickable token palette, a live
  preview, and a Desktop / Mobile support indicator.
- `token-usage.md`, a full token reference.

### Changed
- Complete rewrite around the token engine. The eight former built-in formats
  now ship as seeded, editable custom formats; there is no separate built-in
  code path.
- `minAppVersion` raised from `0.15.0` to `1.5.0` to match the Obsidian APIs the
  plugin uses.
- Settings redesigned. The fixed Path wrapping, Menu display, and
  Paths/Links/Filenames sections are replaced by per-format options.
- Manifest description rewritten for the token-template model.

### Removed
- The fixed built-in format toggles and the global path-wrapping and
  menu-display settings.

### Migration
- Existing 1.18.x settings (which formats were enabled, path wrapping, and the
  Markdown link format) are migrated automatically on first load. No action is
  needed.

### Note
- Block link formats may add a `^id` block marker to a note so the block can be
  linked to, the same as Obsidian does for its own block links. This is the only
  case where the plugin modifies a note. See `PRIVACY.md`.

## [1.18.1] - 2026-05-12

### Fixed
- Added a rationale (after `--`) to the `eslint-disable` directive at `main.ts:14`, clearing the Obsidian scorecard warning "Unexpected undescribed directive comment"

### Changed
- CI workflow now uses Node 20 (required by `eslint-plugin-obsidianmd`'s use of `import.meta.dirname`)
- Added OSV-Scanner, GitHub Dependency Review, and a weekly cron scan to `ci.yml`
- Added VirusTotal scan of release artifacts to `release.yml` (requires `VT_API_KEY` repo secret)
- README now shows CI and Release workflow status badges

### Note
The compiled `main.js` bundle is byte-identical to `1.18.0` (esbuild strips comments). Users on `1.18.0` see no functional or binary change in `1.18.1`. This release exists to update the source tag with the directive-comment fix and to make the release tag's `release.yml` use Node 20.

## [1.18.0] - 2026-05-12

### Fixed
- Marketplace scorecard compliance:
  - Awaited or `void`-marked all clipboard promises in command callbacks (8 sites in `main.ts`)
  - Node `path` module now loaded behind a `Platform.isDesktop` guard via `require()`, replacing a top-level `import` that would fail on mobile
  - Removed banned `General` heading from settings tab
  - Replaced generic `createEl('div'|'span')` calls with `createDiv()` / `createSpan()` in settings UI
  - Moved inline `style` attribute on settings footer into `styles.css` (`.shell-path-copy-footer`)
  - Manifest description now ends with a period
  - Replaced deprecated `builtin-modules` package with Node's `module.builtinModules`
  - Resolved vulnerable transitive devDependencies (`handlebars`, `picomatch`, `flatted`, `ajv`, `brace-expansion`) via npm `overrides`
  - Converted `Path format examples` section to Obsidian's `setHeading()` API (was a div styled with `setting-item-heading`); dropped trailing colon per Obsidian style guide
  - Footer external links now use standard `<a target="_blank" rel="noopener">` instead of an `onclick` handler that called `window.open()`
  - Wired in `eslint-plugin-obsidianmd` recommended config to catch marketplace lint violations at build time
  - Sentence-case UI strings throughout commands, menus, and settings (e.g. `Copy Filename` → `Copy filename`)
  - Replaced `Linux/Mac` with canonical `Linux/macOS` in command names, menu titles, notifications, dropdown options, and examples
  - Capitalized `markdown` → `Markdown` (proper noun) in setting names, descriptions, dropdown options, and error notices
  - Renamed settings headings `Path options` / `Link options` / `Filename options` → `Paths` / `Links` / `Filenames` (the word "options" is blocked by `settings-tab/no-problematic-settings-headings`)
  - Replaced `process.platform === 'win32'` with Obsidian's `Platform.isWin` API for OS detection
  - Tightened `loadSettings()` to cast `loadData()` through `Partial<PathCopySettings>` instead of relying on implicit `any`
  - Narrowed `getNodePath()` return type to a local `NodePathLike` interface so the @types/node `path` namespace is not imported at module scope

### Added
- `CONTRIBUTING.md` covering setup, quality gates, conventions, and PR workflow

### Changed
- README rewritten to use a single `#` H1 with `##`/`###` for sections, sync all command/menu/setting names to current UI strings, replace `Linux/Mac` with `Linux/macOS` throughout, and reframe the BRAT section as optional for pre-release testing (Marketplace install is now the recommended path)

## [1.17.0] - 2026-03-22

### Added
- **Copy Filename** option: copies the filename without extension ([#10](https://github.com/ckelsoe/obsidian-shell-path-copy/issues/10))
- **Copy Filename with Extension** option: copies the filename with extension ([#10](https://github.com/ckelsoe/obsidian-shell-path-copy/issues/10))
- Both options available in context menu and command palette, each independently toggleable in settings
- **Apply path wrapping to filenames** setting: controls whether the global path wrapping applies to copied filenames (off by default, so filenames paste cleanly into emails and chat)
- Settings page now uses section headings (General, Path options, Link options, Filename options) for better organization

### Fixed
- Dotfiles like `.gitignore` no longer lose their name when used in wiki-style markdown links

### Technical
- Extracted `extractFilename` utility from `buildMarkdownLink` for shared use
- Added 6 unit tests for `extractFilename` (43 total tests)

## [1.16.1] - 2026-02-26

### Fixed
- **Absolute path copy now works on Windows** ([#7](https://github.com/ckelsoe/obsidian-shell-path-copy/issues/7))
  - Replaced internal Obsidian API (`getFullRealPath`) that was unavailable on Windows with the public `FileSystemAdapter.getBasePath()` + `path.join()`, which works correctly on all platforms
- **Windows file:// URLs no longer encode the drive letter colon**
  - `C:` was incorrectly encoded as `C%3A`, producing invalid URLs; the drive letter is now preserved verbatim

### Removed
- Dropped unreliable file-explorer DOM querying used by command palette commands to detect which file was focused in the sidebar
  - The approach relied on internal Obsidian CSS class names that could silently break on Obsidian updates, and was ineffective in practice since opening the command palette shifts keyboard focus away from the explorer
  - Command palette commands now require an open file; if none is open, a clear notice is shown: *"Open a file or right-click it in the file explorer"*

### Technical
- Extracted all path-formatting logic into pure functions (`path-utils.ts`) with no Obsidian dependency, making them independently testable
- Added 37 unit tests covering `wrapPath`, `formatRelativePath`, `buildFileUrl`, `buildObsidianUrl`, and `buildMarkdownLink`
- CI now runs the test suite on every push and pull request
- CI now scans for known deprecated Obsidian API usage
- Release workflow now runs tests before building — a failing test prevents a release from being created

## [1.16.0] - 2026-01-25

### Fixed
- **Relative paths now use proper `./` prefix** ([#6](https://github.com/ckelsoe/obsidian-shell-path-copy/issues/6))
  - Linux/Mac paths correctly start with `./` (e.g., `./folder/file.md`)
  - Windows paths correctly start with `.\` (e.g., `.\folder\file.md`)
  - Ensures shell commands work correctly when executed from the vault root

### Added
- CI workflow with automated checks (TypeScript, ESLint, build verification)
- Obsidian manifest validation in CI

### Changed
- Migrated ESLint to v9 flat config format
- Updated GitHub Actions to v4

## [1.15.0] - 2025-11-29

### Added
- **Obsidian URL support**: Copy `obsidian://open?vault=...&file=...` URLs for cross-app integration
- New "Copy as Obsidian URL" option in context menu and command palette
- Settings toggle to show/hide Obsidian URL option
- Obsidian URL format example in settings page
- Documentation for Obsidian URL feature in README
- Use cases: task manager integration, automation workflows, external documentation linking

### Changed
- Updated Notebook Navigator compatibility documentation
- Feature comparison table now shows both plugins support Obsidian URLs
- Enhanced command palette with new Obsidian URL command

### Fixed
- Repository cleanup: removed unused screenshot files
- Updated .gitignore to exclude AI assistant files and local workspace settings

## [1.14.0] - 2025-09-16

### Added
- **Copy as Markdown Link** feature with two formats:
  - Wiki-style: `[[filename]]` (default, perfect for Obsidian)
  - Standard markdown: `[filename.md](path)` (universal compatibility)
- New markdown link settings: visibility toggle and format selection
- Context menu and command palette integration for markdown links
- Enhanced path format examples in settings to include markdown links

### Changed
- OS-specific absolute path commands now show "Copy as absolute Windows path" or "Copy as absolute Linux/Mac path" based on operating system
- Improved absolute path handling with better cross-platform support
- Enhanced UI with better format examples and descriptions

### Technical
- Comprehensive settings integration for all new features
- Smart filename handling for different markdown formats
- Maintains backward compatibility with all existing functionality

## [1.13.0] - 2025-08-16

### Added
- **file:// URL copy format** for sharing files with AI coding tools
- Support for file:// URLs on desktop platforms (Windows, Linux, macOS)
- URL encoding for special characters in file paths

### Fixed
- Resolved Obsidian community plugin review requirements
- Fixed GitHub release tag format to properly match manifest.json version (without 'v' prefix)

## [1.12.0] - 2025-07-29

### Changed
- Cleaned up settings tab to comply with Obsidian guidelines
- Removed redundant plugin description from settings page
- Removed "Settings" heading (only use headings when there are multiple sections)
- Moved GitHub links to a subtle footer at the bottom
- Settings now start directly with content for better UX

## [1.11.1] - 2025-07-XX

### Fixed
- Minor bug fixes and stability improvements

## [1.11.0] - 2025-07-XX

### Added
- Initial public release
- Copy relative paths in Linux/Mac and Windows formats
- Copy absolute paths (desktop only)
- Configurable path wrapping (none, double quotes, single quotes, backticks)
- Context menu integration in file explorer
- Command palette commands
- Platform-specific behavior (desktop vs mobile)
- Settings page for configuration

### Features
- Right-click context menu integration
- Multiple path format support
- Smart path wrapping for paths with spaces
- Success notifications
- Works on desktop and mobile platforms

[unreleased]: https://github.com/ckelsoe/obsidian-shell-path-copy/compare/2.0.0...HEAD
[2.0.0]: https://github.com/ckelsoe/obsidian-shell-path-copy/compare/1.18.1...2.0.0
[1.17.0]: https://github.com/ckelsoe/obsidian-shell-path-copy/compare/1.16.1...1.17.0
[1.16.1]: https://github.com/ckelsoe/obsidian-shell-path-copy/compare/1.16.0...1.16.1
[1.16.0]: https://github.com/ckelsoe/obsidian-shell-path-copy/compare/1.15.0...1.16.0
[1.15.0]: https://github.com/ckelsoe/obsidian-shell-path-copy/compare/1.14.0...1.15.0
[1.14.0]: https://github.com/ckelsoe/obsidian-shell-path-copy/compare/1.13.0...1.14.0
[1.13.0]: https://github.com/ckelsoe/obsidian-shell-path-copy/compare/1.12.0...1.13.0
[1.12.0]: https://github.com/ckelsoe/obsidian-shell-path-copy/compare/1.11.1...1.12.0
[1.11.1]: https://github.com/ckelsoe/obsidian-shell-path-copy/compare/1.11.0...1.11.1
[1.11.0]: https://github.com/ckelsoe/obsidian-shell-path-copy/releases/tag/1.11.0

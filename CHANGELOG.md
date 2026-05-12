# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

[unreleased]: https://github.com/ckelsoe/obsidian-shell-path-copy/compare/1.17.0...HEAD
[1.17.0]: https://github.com/ckelsoe/obsidian-shell-path-copy/compare/1.16.1...1.17.0
[1.16.1]: https://github.com/ckelsoe/obsidian-shell-path-copy/compare/1.16.0...1.16.1
[1.16.0]: https://github.com/ckelsoe/obsidian-shell-path-copy/compare/1.15.0...1.16.0
[1.15.0]: https://github.com/ckelsoe/obsidian-shell-path-copy/compare/1.14.0...1.15.0
[1.14.0]: https://github.com/ckelsoe/obsidian-shell-path-copy/compare/1.13.0...1.14.0
[1.13.0]: https://github.com/ckelsoe/obsidian-shell-path-copy/compare/1.12.0...1.13.0
[1.12.0]: https://github.com/ckelsoe/obsidian-shell-path-copy/compare/1.11.1...1.12.0
[1.11.1]: https://github.com/ckelsoe/obsidian-shell-path-copy/compare/1.11.0...1.11.1
[1.11.0]: https://github.com/ckelsoe/obsidian-shell-path-copy/releases/tag/1.11.0

# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

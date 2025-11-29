# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

[unreleased]: https://github.com/ckelsoe/obsidian-shell-path-copy/compare/1.15.0...HEAD
[1.15.0]: https://github.com/ckelsoe/obsidian-shell-path-copy/compare/1.14.0...1.15.0
[1.14.0]: https://github.com/ckelsoe/obsidian-shell-path-copy/compare/1.13.0...1.14.0
[1.13.0]: https://github.com/ckelsoe/obsidian-shell-path-copy/compare/1.12.0...1.13.0
[1.12.0]: https://github.com/ckelsoe/obsidian-shell-path-copy/compare/1.11.1...1.12.0
[1.11.1]: https://github.com/ckelsoe/obsidian-shell-path-copy/compare/1.11.0...1.11.1
[1.11.0]: https://github.com/ckelsoe/obsidian-shell-path-copy/releases/tag/1.11.0

# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project Overview

An Obsidian plugin that adds shell-friendly file path copying functionality with support for multiple path formats (Linux/Mac, Windows, absolute paths, file:// URLs, and markdown links). The plugin targets both desktop and mobile Obsidian environments.

## Development Commands

### Build and Development
- `npm install` - Install dependencies
- `npm run dev` - Start development build with auto-reload (watches for changes)
- `npm run build` - Production build with TypeScript type checking
- `npm run version` - Bump version in manifest.json and versions.json

### Testing the Plugin
1. Run `npm run dev` to start the development build
2. Copy `main.js`, `manifest.json`, and `styles.css` to a test vault's `.obsidian/plugins/shell-path-copy/` directory
3. Reload Obsidian or disable/enable the plugin to see changes

## Release Process

**CRITICAL**: Always follow this exact sequence to avoid releasing broken builds.

1. **Update version**: `npm run version`
2. **Build the plugin**: `npm run build`
3. **Verify the build**: Check that `main.js`, `manifest.json`, and `styles.css` are correct
4. **Commit version changes**: `git add manifest.json versions.json && git commit -m "Bump version to X.Y.Z" && git push`
5. **Create GitHub release WITH files**:
   ```bash
   gh release create X.Y.Z main.js manifest.json styles.css \
     --title "Release X.Y.Z" \
     --notes "Release notes here"
   ```
6. **Verify the release**: `gh release view X.Y.Z --json assets`

**NEVER**:
- Create a release without the three required files (main.js, manifest.json, styles.css)
- Upload an old/cached version of main.js
- Forget to build before releasing

## Architecture

### Core Plugin Structure

**main.ts** - Single-file plugin implementation that:
- Registers context menu items for file explorer right-click actions
- Registers command palette commands (dynamically based on user settings)
- Manages settings via Obsidian's PluginSettingTab
- Handles clipboard operations using navigator.clipboard API
- Implements platform-specific behavior (desktop vs mobile via Platform.isMobile)

### Path Format Logic

The plugin converts file paths between formats:
- **Relative paths**: From vault root (e.g., `/folder/file.md` or `\folder\file.md`)
- **Absolute paths**: Full system paths (desktop only, uses `FileSystemAdapter.getFullRealPath()`)
- **File URLs**: `file://` protocol URLs with proper encoding
- **Markdown links**: Wiki-style `[[filename]]` or standard `[filename](path)`

Path wrapping is controlled by user settings (none, double quotes, single quotes, or backticks).

### Platform Detection

Uses `Platform.isMobile` to:
- Hide absolute path and file URL features on mobile (not available in mobile API)
- Conditionally register commands and menu items based on platform
- Prevent runtime errors when platform-specific APIs are unavailable

### Dynamic Command Registration

Commands are registered conditionally based on:
- `menuDisplay` setting (both/windows/linux-mac) - determines which relative path commands appear
- `showAbsolutePath` - toggles absolute path command (desktop only)
- `showFileUrl` - toggles file URL command (desktop only)
- `showMarkdownLink` - toggles markdown link command

User must reload Obsidian when changing these settings for command palette to update.

### File Selection Logic

Methods in priority order:
1. `getActiveFile()` - Currently open/active file in workspace
2. `getFocusedFileInExplorer()` - File/folder with focus in file explorer (uses `.is-focused` class and `data-path` attribute)
3. Shows error notice if no file is selected

### Type Safety

- Uses TypeScript with strict null checks and no implicit any
- Custom type extensions in `types.d.ts` for undocumented Obsidian APIs
- **NEVER use `as any` casting** - create proper type declarations instead
- Uses duck typing with type guards (e.g., `hasGetFullRealPath()`) for runtime safety

## Build Configuration

- **Bundler**: esbuild with tree shaking
- **Output**: CommonJS format (required by Obsidian)
- **Target**: ES2018
- **Externals**: obsidian, electron, @codemirror/* (provided by Obsidian at runtime)
- **Source maps**: Inline in dev, disabled in production
- **Minification**: Production only

## Critical Rules

### Code Preservation
- **NEVER revert to older code versions** unless explicitly instructed
- **NEVER change UI/UX elements** that have been approved in previous releases unless specifically asked
- **ALWAYS preserve existing functionality** when adding new features
- The settings page format in v1.13.0 was specifically approved by Obsidian reviewers - DO NOT modify it

### Obsidian Compliance
All changes MUST follow official Obsidian plugin documentation at https://docs.obsidian.md/Plugins including:
- Plugin development best practices
- Mobile development guidelines
- Performance optimization (load time, deferred views)
- Release and submission requirements
- Plugin guidelines and style guide

**MANDATORY**: Read and follow ALL Obsidian plugin documentation before making ANY changes to code, documentation, or plugin metadata.

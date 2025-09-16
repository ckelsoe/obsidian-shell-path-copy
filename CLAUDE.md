# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## CRITICAL RULES

### Code Preservation
- **NEVER revert to older code versions** unless explicitly instructed by the user
- **NEVER change UI/UX elements** that have been approved in previous releases unless specifically asked
- **ALWAYS preserve existing functionality** when adding new features
- **NEVER EVER use 'as any' casting** - if TypeScript types are missing, create proper type declarations in types.d.ts instead
- The settings page format in v1.13.0 was specifically approved by Obsidian reviewers - DO NOT modify it

### Obsidian Official Guidelines - CRITICAL COMPLIANCE
All code changes MUST follow these official Obsidian guidelines:

**Plugin Development Documentation:**
1. **Build a Plugin**: https://docs.obsidian.md/Plugins/Getting+started/Build+a+plugin
2. **Anatomy of a Plugin**: https://docs.obsidian.md/Plugins/Getting+started/Anatomy+of+a+plugin
3. **Development Workflow**: https://docs.obsidian.md/Plugins/Getting+started/Development+workflow
4. **Mobile Development**: https://docs.obsidian.md/Plugins/Getting+started/Mobile+development
5. **Use React in Plugin**: https://docs.obsidian.md/Plugins/Getting+started/Use+React+in+your+plugin
6. **Use Svelte in Plugin**: https://docs.obsidian.md/Plugins/Getting+started/Use+Svelte+in+your+plugin

**Plugin Optimization & Best Practices:**
7. **Optimizing Load Time**: https://docs.obsidian.md/Plugins/Guides/Optimizing+plugin+load+time
8. **Understanding Deferred Views**: https://docs.obsidian.md/Plugins/Guides/Understanding+deferred+views

**Release & Submission:**
9. **Plugin Guidelines**: https://docs.obsidian.md/Plugins/Releasing/Plugin+guidelines
10. **Release Process**: https://docs.obsidian.md/Plugins/Releasing/Release+your+plugin+with+GitHub+Actions
11. **Submission Requirements**: https://docs.obsidian.md/Plugins/Releasing/Submission+requirements+for+plugins

**Style & Writing:**
12. **Style Guide**: https://help.obsidian.md/style-guide
13. **Writing Style**: https://docs.openedx.org/en/latest/documentors/references/doc_english_writing.html

**MANDATORY**: Read and follow ALL Obsidian plugin documentation (https://docs.obsidian.md/Plugins) before making ANY changes to code, documentation, or plugin metadata.

## Development Commands

### Build and Development
- `npm install` - Install dependencies
- `npm run dev` - Start development build with auto-reload (watches for changes)
- `npm run build` - Production build with TypeScript type checking
- `npm run version` - Bump version in manifest.json and versions.json

### Testing
To test the plugin:
1. Run `npm run dev` to start the development build
2. Copy `main.js`, `manifest.json`, and `styles.css` to your test vault's `.obsidian/plugins/shell-path-copy/` directory
3. Reload Obsidian or disable/enable the plugin

## Release Process for Obsidian Plugins

### CORRECT Release Steps
1. **Update version number**:
   ```bash
   npm run version
   ```

2. **Build the plugin**:
   ```bash
   npm run build
   ```

3. **Verify the build**:
   - Check that `main.js` was generated correctly
   - Ensure `manifest.json` has the correct version
   - Confirm `styles.css` exists (even if minimal)

4. **Commit version changes**:
   ```bash
   git add manifest.json versions.json
   git commit -m "Bump version to X.Y.Z"
   git push
   ```

5. **Create GitHub release WITH files**:
   ```bash
   gh release create X.Y.Z main.js manifest.json styles.css \
     --title "Release X.Y.Z" \
     --notes "Release notes here"
   ```
   
   **CRITICAL**: Always include the three required files in the release command:
   - `main.js` - The compiled plugin code
   - `manifest.json` - Plugin metadata for Obsidian
   - `styles.css` - Plugin styles (even if empty)

6. **Verify the release**:
   ```bash
   gh release view X.Y.Z --json assets
   ```
   Confirm all three files are present in the assets list

### What NOT to do
- **NEVER** create a release without the plugin files
- **NEVER** upload an old/cached version of main.js
- **NEVER** forget to build before releasing
- **NEVER** modify the settings UI without explicit user request

## Architecture Overview

This is an Obsidian plugin that adds file path copying functionality with shell-friendly formatting. The plugin architecture follows Obsidian's plugin API patterns.

### Core Components

1. **main.ts** - Main plugin class that:
   - Registers context menu items for file explorer
   - Registers command palette commands
   - Manages settings and clipboard operations
   - Handles platform-specific behavior (desktop vs mobile)

2. **Settings System**:
   - Uses Obsidian's PluginSettingTab for UI
   - Settings stored via Obsidian's data API
   - Key settings: pathWrapping, menuDisplay, showAbsolutePath, notifications

3. **Path Formatting**:
   - Converts between Unix/Linux/Mac paths (forward slashes) and Windows paths (backslashes)
   - Handles relative paths (from vault root) and absolute paths (full system path)
   - Wraps paths in quotes/backticks based on user preference

### Key Design Decisions

1. **Platform Detection**: Uses `Platform.isMobile` to disable absolute path functionality on mobile devices where it's not available

2. **Dynamic Command Registration**: Commands are registered based on user settings (menuDisplay) to keep the command palette clean

3. **Clipboard API**: Uses modern `navigator.clipboard` API with proper error handling

4. **File Selection Logic**: 
   - First tries to get the active file (currently open)
   - Falls back to focused file in file explorer
   - Shows error if no file is selected

5. **Menu Sections**: Uses Obsidian's menu sections to group path copy options together

### TypeScript Configuration

- Targets ES6 with ESNext modules
- Strict null checks enabled
- No implicit any
- Uses Obsidian's type definitions from npm

### Build Process

- esbuild for bundling with tree shaking
- External dependencies properly configured (obsidian, electron, codemirror)
- Source maps in development, minified in production
- CommonJS output format for Obsidian compatibility
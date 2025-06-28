# Obsidian Path Copy Plugin Requirements

## Overview
An Obsidian plugin that adds context menu items to copy file and folder paths relative to the vault root. The primary use case is to quickly copy paths that can be pasted into AI assistants like Claude Code for precise file/folder references.

## Core Features

### 1. Context Menu Integration
- Add right-click menu items to both files and folders in Obsidian's file explorer
- Menu items appear when right-clicking on:
  - Files (any type)
  - Folders
  - The vault root folder

### 2. Path Copy Options

#### 2.1 Basic Menu Items (Minimum Viable Product)
- **Copy Linux Path**: Copies path with forward slashes (/)
  - Example: `/doc/requirements.md`
  - Example: `/plugins/my-plugin`
- **Copy Windows Path**: Copies path with backslashes (\)
  - Example: `\doc\requirements.md`
  - Example: `\plugins\my-plugin`

#### 2.2 Advanced Menu Items (Optional Enhancement)
- **Copy Absolute Linux Path**: Includes full system path
  - Example: `/home/user/Documents/MyVault/doc/requirements.md`
- **Copy Absolute Windows Path**: Includes drive letter and full path
  - Example: `C:\Users\User\Documents\MyVault\doc\requirements.md`

### 3. Path Formatting

#### 3.1 Basic Rules
- Paths are always relative to vault root (unless absolute option is used)
- File paths include the complete filename with extension
- Folder paths do not include trailing slashes
- The vault root itself is represented as `/` (Linux) or `\` (Windows)

#### 3.2 Path Wrapping
- Setting to control how paths are wrapped when copied
- Options:
  - **None**: No wrapping
  - **Double Quotes**: `"path/to/file.md"`
  - **Single Quotes**: `'path/to/file.md'`
  - **Backticks**: `` `path/to/file.md` `` (default)
- Default: Backticks (helps with paths containing spaces)

### 4. Operating System Detection
- Plugin should auto-detect the current operating system
- Option 1: Show only relevant path format based on OS
- Option 2: Always show both options (preferred for flexibility)
- User preference setting to control this behavior

## Settings

### Plugin Settings Page
1. **Path Wrapping**
   - Dropdown: None / Double Quotes / Single Quotes / Backticks
   - Default: Backticks

2. **Menu Display**
   - Toggle: Show both OS formats / Show only current OS format
   - Default: Show both

3. **Include Absolute Paths**
   - Toggle: Show absolute path options in menu
   - Default: Off

4. **Menu Item Order**
   - Configurable order of menu items
   - Default order:
     1. Copy Linux Path
     2. Copy Windows Path
     3. Copy Absolute Linux Path (if enabled)
     4. Copy Absolute Windows Path (if enabled)

## Technical Requirements

### Compatibility
- Obsidian API version: Latest stable
- Support for desktop platforms (Windows, macOS, Linux)
- Mobile support: Not required for initial version

### Implementation Details
- Use Obsidian's context menu API
- Clipboard interaction using Obsidian's clipboard API
- Path manipulation using Node.js path module
- Settings storage using Obsidian's plugin settings

### Error Handling
- Gracefully handle edge cases:
  - Empty vault
  - Special characters in paths
  - Very long paths
  - Paths with unicode characters

## User Experience

### Success Feedback
- Brief notification (toast) showing "Path copied!" when successful
- Different messages for different actions:
  - "Linux path copied!"
  - "Windows path copied!"
  - "Absolute path copied!"

### Menu Organization
- Group all path copy options under a submenu called "Copy Path"
- Submenu structure:
  ```
  Copy Path >
    ├── Linux Path
    ├── Windows Path
    ├── Absolute Linux Path
    └── Absolute Windows Path
  ```

## Examples

### File Examples
Right-clicking on `meeting-notes.md` in `/doc/2024/` folder:
- Linux Path: `` `/doc/2024/meeting-notes.md` ``
- Windows Path: `` `\doc\2024\meeting-notes.md` ``

### Folder Examples
Right-clicking on `templates` folder in vault root:
- Linux Path: `` `/templates` ``
- Windows Path: `` `\templates` ``

### Vault Root Example
Right-clicking on vault root:
- Linux Path: `` `/` ``
- Windows Path: `` `\` ``

## Future Enhancements (Out of Scope for v1)
- Keyboard shortcuts for quick access
- Bulk copy (multiple files/folders)
- Path transformation options (e.g., URL encoding)
- Integration with other plugins
- Copy as markdown link format
- Custom path templates

## Success Criteria
1. Users can right-click any file/folder and copy its path
2. Copied paths work correctly when pasted into Claude Code or similar tools
3. Paths with spaces are properly handled with the wrapping option
4. Plugin works consistently across Windows, macOS, and Linux
5. Settings persist between Obsidian sessions
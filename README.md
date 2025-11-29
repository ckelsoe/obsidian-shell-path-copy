# Shell Path Copy for Obsidian

[https://github.com/ckelsoe/obsidian-shell-path-copy](https://github.com/ckelsoe/obsidian-shell-path-copy)

An Obsidian plugin for copying file and folder paths with shell-friendly formatting.

# Why This Plugin?

Today's workflows often involve using Obsidian alongside terminal-based AI assistants, such as Claude Code or Gemini CLI. You might be using Obsidian on Windows, macOS, Linux, or even on mobile devices like iPads and Android tablets (which can run both Obsidian and terminal apps). Regardless of your setup, whether that's Obsidian on Windows with a WSL terminal, Obsidian on your iPad connected to a remote Linux server, or any other combination, you face the same challenge: copying file paths from Obsidian that work correctly in your target terminal environment.

In these scenarios, you need to copy file paths from your vault for use in shell commands or AI assistant prompts. Obsidian's native "Copy file path" command is buried in the command palette and only provides a single path format, which may not match your target system's requirements.

**Shell Path Copy** improves this workflow by:

1. Adding path copying options directly to the **right-click context menu** in the file explorer.
2. Providing **both Linux/Mac and Windows path formats**, ensuring you can get the correct format for your target environment, regardless of the device you are using.

# Features

Shell Path Copy offers a comprehensive set of features designed to streamline your workflow, all of which are configurable via its dedicated settings tab.

* **Right-click menu integration**: Adds "Copy Path" options to files and folders in the file explorer
* **Command Palette Integration**: Direct commands for each path format, respecting your display preferences
* **Multiple path formats**:
   * **Relative Paths** \- Path is relative to the vault root (Desktop and Mobile):
      * Windows: `\doc\file.md`
      * Linux and macOS: `/doc/file.md`
   * **Absolute Path** \- Path is relative to the root of the filesystem (Desktop Only):
      * Windows: `C:\Users\YourName\Documents\Obsidian\MyVault\doc\file.md`
      * Linux and macOS: `/home/user/Documents/Obsidian/MyVault/doc/file.md`
   * **File URL format** (Desktop Only):
      * Windows: `file:///C:/Users/YourName/Documents/Obsidian/MyVault/doc/file.md`
      * Linux and macOS: `file:///home/user/Documents/Obsidian/MyVault/doc/file.md`
      * Automatically handles platform-specific formatting
      * URL-encodes special characters for compatibility
   * **Obsidian URL format**:
      * `obsidian://open?vault=MyVault&file=doc/file`
      * Works on all platforms (desktop and mobile)
      * Perfect for cross-linking from other applications
   * **Markdown Link format**:
      * Wiki-style: `[[filename]]` (default, perfect for Obsidian)
      * Standard markdown: `[filename.md](/path/filename.md)` (universal compatibility)
* **Configurable display options**: Choose which path formats appear in menus:
   * Show both Windows and Linux/Mac options (default)
   * Show Windows options only
   * Show Linux/Mac options only
* **Smart path wrapping**: Automatically wraps paths using configurable delimiters to handle spaces properly. Options include:
   * None: `path/to/file`
   * Double Quotes: `"path/to/file"`
   * Single Quotes: `'path/to/file'`
   * Backticks: \`path/to/file\` (default - recommended for paths with spaces)
* **Success notifications**: Visual feedback when paths are copied

# Installation

## From Obsidian Community Plugins (Recommended)

1. Open Obsidian Settings
2. Navigate to **Community plugins**
3. Click **Browse** to open the Community Plugins browser
4. Search for **"Shell Path Copy"**
5. Click **Install**, then **Enable**

## Using BRAT (For Beta Testing)

Use BRAT if you want to test beta or pre-release versions:

1. Install the BRAT plugin from Community Plugins
2. Open BRAT settings and click "Add Beta Plugin"
3. Enter: [`https://github.com/ckelsoe/obsidian-shell-path-copy`](https://github.com/ckelsoe/obsidian-shell-path-copy)
4. Click "Add Plugin"
5. Enable "Shell Path Copy" in Settings → Community plugins

## Manual Installation

1. Download `main.js`, `manifest.json`, and `styles.css` from this repository
2. Create a folder named `shell-path-copy` in your vault's `.obsidian/plugins/` directory
3. Copy the downloaded files into this folder
4. Reload Obsidian
5. Enable "Shell Path Copy" in Settings → Community Plugins

# Usage

Shell Path Copy provides flexible ways to copy paths:

# From the File Explorer Context Menu (Right-Click)

1. Right-click any file or folder in the Obsidian file explorer.
2. Select "Copy Path" from the context menu.
3. Choose your desired format:
   * **Copy Linux/Mac Path**: For Unix/Linux/macOS systems (e.g., `/folder/file.md`)
   * **Copy Windows Path**: For Windows systems (e.g., `\folder\file.md`)
   * **Copy Absolute Path**: For the full system path (Desktop Only)
   * **Copy as file:// URL**: For file URL format (Desktop Only)
   * **Copy as Obsidian URL**: For obsidian:// protocol links
   * **Copy as Markdown Link**: For documentation and note-taking (e.g., `[[filename]]` or `[filename.md](path)`)
4. The path is copied to your clipboard, wrapped in backticks by default.
5. Paste it anywhere you need!

# From the Command Palette (Ctrl/Cmd+P)

1. Open the Command Palette (Ctrl/Cmd+P).
2. Type "Shell Path Copy" or "Copy Path" to filter commands.
3. Available commands depend on your settings:
   * "Shell Path Copy: Copy as Linux/Mac path" (shown when set to "both" or "Linux/Mac only")
   * "Shell Path Copy: Copy as Windows path" (shown when set to "both" or "Windows only")
   * "Shell Path Copy: Copy as absolute path" (Desktop only)
   * "Shell Path Copy: Copy as file:// URL" (Desktop only)
   * "Shell Path Copy: Copy as Obsidian URL" (when enabled in settings)
   * "Shell Path Copy: Copy as markdown link" (when enabled in settings)
4. The path of the currently active file (or focused file in the explorer) will be copied.

# Example: The Remote Workflow

Imagine you are viewing [`My-Project-Plan.md`](http://My-Project-Plan.md) in Obsidian on your iPad. You are connected to your Linux development server using an SSH client like **Termius**. You need to tell a colleague (or an AI assistant like Gemini) to view the contents of that file on the server.

With Shell Path Copy:

1. In Obsidian on your iPad, **right-click** on `My-Project-Plan.md`.
2. Select **"Copy Linux/Mac Path"**.
3. The string `\`/My-Project-Plan.md\`\` is now on your clipboard.
4. Paste it directly into your Termius session: `cat /My-Project-Plan.md`

No manual editing, no mistakes, no context switching. It just works.

# File URL Format (Desktop Only)

For desktop users who need to create clickable file:// URLs:

1. Right-click any file or folder in the file explorer
2. Select "Copy as file:// URL"
3. The full file:// URL is copied to your clipboard

This is particularly useful for:
* Creating clickable links in browsers
* Working with applications that accept file:// URLs
* Documentation that needs absolute file references
* Opening files in external applications via URLs

Example outputs:
* **Windows**: `file:///C:/Users/John/Documents/vault/note.md`
* **Linux**: `file:///home/john/Documents/vault/note.md`
* **macOS**: `file:///Users/john/Documents/vault/note.md`

# Obsidian URL Format

For users who want to create clickable links that open files directly in Obsidian:

1. Right-click any file in the file explorer
2. Select "Copy as Obsidian URL"
3. The full obsidian:// URL is copied to your clipboard

This is particularly useful for:
* Creating links from task managers (Todoist, OmniFocus, etc.)
* Linking from external documentation or wikis
* Building automation workflows
* Cross-app integration

Example output:
* `obsidian://open?vault=MyVault&file=Projects/Project%20Plan`

# Markdown Link Format

For users who want to create internal links or documentation:

1. Right-click any file in the file explorer
2. Select "Copy as Markdown Link"
3. Choose your preferred format in settings:
   * **Wiki-style** (default): `[[My Document]]` - Perfect for Obsidian internal linking
   * **Standard markdown**: `[My Document.md](/folder/My Document.md)` - Universal markdown compatibility

This is particularly useful for:
* Creating internal note references in Obsidian
* Documentation that uses markdown formatting
* Cross-referencing files in project notes
* Building linked knowledge bases

# Compatibility with Notebook Navigator

[Notebook Navigator](https://github.com/johansan/notebook-navigator) is a popular plugin that replaces Obsidian's default file explorer with an enhanced interface. If you use Notebook Navigator, you'll find that it includes some built-in path copying functionality.

## Feature Comparison

| Feature | Shell Path Copy | Notebook Navigator |
|---------|----------------|-------------------|
| Copy vault-relative path | ✅ Linux/Mac & Windows formats | ✅ Single format |
| Copy absolute path | ✅ With configurable wrapping | ✅ Without wrapping |
| Copy file:// URL | ✅ | ❌ |
| Copy Obsidian URL | ✅ | ✅ |
| Copy markdown link | ✅ Wiki-style & standard | ❌ |
| Configurable path wrapping | ✅ (backticks, quotes, none) | ❌ |
| Platform-specific formats | ✅ (Windows vs Linux/Mac) | ❌ |

## Using Shell Path Copy with Notebook Navigator

Shell Path Copy's context menu items only appear in Obsidian's native file explorer. However, you can still access all functionality through the **Command Palette** (`Ctrl/Cmd+P`):

- "Shell Path Copy: Copy as Linux/Mac path"
- "Shell Path Copy: Copy as Windows path"
- "Shell Path Copy: Copy as absolute path"
- "Shell Path Copy: Copy as file:// URL"
- "Shell Path Copy: Copy as Obsidian URL"
- "Shell Path Copy: Copy as markdown link"

These commands work on the currently active file or the focused file in either file explorer.

## Future Integration

We have no current plans to integrate directly with Notebook Navigator's context menus. If you would like to see deeper integration between these plugins, please [open an issue](https://github.com/ckelsoe/obsidian-shell-path-copy/issues) describing your use case. We'll consider investigating integration options if there is sufficient community interest.

# Example Use Cases

* Sharing file locations with AI Assistants like Claude Code or Gemini CLI
* Creating internal note references and linked knowledge bases
* Documenting file structures in notes
* Creating file references in technical documentation
* Quick file path sharing in team communications

# Settings

Access plugin settings via Settings → Plugin Options → Shell Path Copy:

* **Path Wrapping**: Choose how paths are wrapped when copied to the clipboard (none, double quotes, single quotes, or backticks)
* **Menu Display**: Control which path formats appear in both the context menu and command palette:
   * Show both Windows and Linux/Mac options (default)
   * Show Windows options only
   * Show Linux/Mac options only
* **Show Absolute Path Option** (Desktop only): Toggle whether the absolute path copy option appears in menus
* **Show file:// URL option** (Desktop only): Toggle whether the file:// URL copy option appears in menus
* **Show Obsidian URL Option**: Toggle whether the Obsidian URL copy option appears in menus
* **Show Markdown Link Option**: Toggle whether the markdown link copy option appears in menus
* **Markdown Link Format**: Choose between wiki-style (`[[filename]]`) and standard markdown (`[filename](path)`) formats
* **Show Notifications**: Toggle success notifications on/off

# Development

This section is for developers who want to modify or extend the plugin for their use. If you want to install and use Shell Path Copy, you can skip this section entirely. The installation instructions above provide everything needed for regular usage.

# Prerequisites

* Node.js 16+
* npm or yarn

# Setup

    # Clone the repository
    git clone https://github.com/ckelsoe/obsidian-shell-path-copy.git
    
    # Navigate to the src directory
    cd obsidian-shell-path-copy
    
    # Install dependencies
    npm install
    
    # Start development build with auto-reload
    npm run dev

# Building

    # Build for production
    npm run build

# Code Quality

This plugin uses TypeScript for type checking. Run type checking with:

    npm run build

# Contributing

Contributions are welcome! Here's how you can help:

# Reporting Issues

Please open an issue on the [GitHub repository](https://github.com/ckelsoe/obsidian-shell-path-copy/issues) for bug reports or feature requests.

# Pull Requests

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

Please open an issue first to discuss significant changes.

# License

This project is licensed under the MIT License - see the LICENSE file for details.

# Acknowledgments

* Inspired by the need for better file path handling when working with AI coding assistants
* Built for [Obsidian](https://obsidian.md) using the [Obsidian API](https://github.com/obsidianmd/obsidian-api)
* A special thank you to the Obsidian developers for creating such a powerful and extensible product. This plugin would not be possible without their incredible work.
* Thanks to the Obsidian community for their support and feedback

# Support

If you find this plugin helpful, consider:

* ⭐ Starring the repository on GitHub
* 🐛 Reporting bugs or suggesting features via [GitHub Issues](https://github.com/ckelsoe/obsidian-shell-path-copy/issues)

# Shell Path Copy for Obsidian

An Obsidian plugin for copying file and folder paths with shell-friendly formatting.

## Why This Plugin?

Modern development workflows often involve multiple operating systems. You might use Obsidian on a Mac or iPad, but connect to a remote Linux server via a terminal (like **Termius**, **Windows Terminal**, or **Tabby**), or work with a Windows Subsystem for Linux (WSL) environment.

In these scenarios, you need to copy file paths from your vault for use in a shell or with AI Assistants such as Claude Code or Gemini. Obsidian's native "Copy file path" command is located in the command palette and only provides a single path format, which may not match your target system.

**Shell Path Copy** improves this workflow by:
1.  Adding path copying options directly to the **right-click context menu** in the file explorer.
2.  Providing **both Linux/Mac and Windows path formats**, ensuring you can get the correct format for your target environment, regardless of the device you are using.

## Features

Shell Path Copy provides a robust set of features designed to streamline your workflow, all configurable via its dedicated settings tab.

-   **Right-click menu integration**: Adds "Copy Path" options to files and folders in the file explorer
-   **Command Palette Integration**: Direct commands for each path format, respecting your display preferences
-   **Multiple path formats**:
    -   **Relative Paths** - Path is relative to the vault root (Desktop and Mobile):
        -   Windows: `\doc\file.md`
        -   Linux and macOS: `/doc/file.md`
    -   **Absolute Path** - Path is relative to the root of the filesystem (Desktop Only):
        -   Windows: `C:\Users\YourName\Documents\Obsidian\MyVault\doc\file.md`
        -   Linux and macOS: `/home/user/Documents/Obsidian/MyVault/doc/file.md`
-   **Configurable display options**: Choose which path formats appear in menus:
    -   Show both Windows and Linux/Mac options (default)
    -   Show Windows options only
    -   Show Linux/Mac options only
-   **Smart path wrapping**: Automatically wraps paths using configurable delimiters to handle spaces properly. Options include:
    -   None: `path/to/file`
    -   Double Quotes: `"path/to/file"`
    -   Single Quotes: `'path/to/file'`
    -   Backticks: `` `path/to/file` `` (default - recommended for paths with spaces)
-   **Success notifications**: Visual feedback when paths are copied

## Installation

### From Obsidian Community Plugins
This plugin is pending submission to the official Obsidian plugin repository.

### Using BRAT (Beta Reviewers Auto-update Tool)
This is an interim installation method until the plugin is available in the official Obsidian community plugins.
1. Install the BRAT plugin from Community Plugins
2. Open BRAT settings and click "Add Beta Plugin"
3. Enter: `https://github.com/ckelsoe/obsidian-shell-path-copy`
4. Click "Add Plugin"
5. Enable "Shell Path Copy" in Settings → Community plugins

### Manual Installation
1. Download `main.js`, `manifest.json`, and `styles.css` from this repository
2. Create a folder named `shell-path-copy` in your vault's `.obsidian/plugins/` directory
3. Copy the downloaded files into this folder
4. Reload Obsidian
5. Enable "Shell Path Copy" in Settings → Community Plugins

## Usage

Shell Path Copy provides flexible ways to copy paths:

### From the File Explorer Context Menu (Right-Click)
1. Right-click any file or folder in the Obsidian file explorer.
2. Select "Copy Path" from the context menu.
3. Choose your desired format:
   - **Copy Linux/Mac Path**: For Unix/Linux/macOS systems (e.g., `/folder/file.md`)
   - **Copy Windows Path**: For Windows systems (e.g., `\folder\file.md`)
   - **Copy Absolute Path**: For the full system path (Desktop Only)
4. The path is copied to your clipboard, wrapped in backticks by default.
5. Paste it anywhere you need!

### From the Command Palette (Ctrl/Cmd+P)
1. Open the Command Palette (Ctrl/Cmd+P).
2. Type "Shell Path Copy" or "Copy Path" to filter commands.
3. Available commands depend on your Menu Display setting:
   - "Shell Path Copy: Copy as Linux/Mac path" (shown when set to "both" or "Linux/Mac only")
   - "Shell Path Copy: Copy as Windows path" (shown when set to "both" or "Windows only")
   - "Shell Path Copy: Copy as absolute path" (Desktop only)
4. The path of the currently active file (or focused file in the explorer) will be copied.

### Example: The Remote Workflow

Imagine you are viewing `My-Project-Plan.md` in Obsidian on your iPad. You are connected to your Linux development server using an SSH client like **Termius**. You need to tell a colleague (or an AI assistant like Gemini) to view the contents of that file on the server.

With Shell Path Copy:

1.  In Obsidian on your iPad, **right-click** on `My-Project-Plan.md`.
2.  Select **"Copy Linux/Mac Path"**.
3.  The string `` `/My-Project-Plan.md` `` is now on your clipboard.
4.  Paste it directly into your Termius session: `cat /My-Project-Plan.md`

No manual editing, no mistakes, no context switching. It just works.

### Example Use Cases
- Sharing file locations with AI Assistants like Claude Code or Gemini
- Documenting file structures in notes
- Creating file references in technical documentation
- Quick file path sharing in team communications

## Settings

Access plugin settings via Settings → Plugin Options → Shell Path Copy:

- **Path Wrapping**: Choose how paths are wrapped when copied to clipboard (none, double quotes, single quotes, or backticks)
- **Menu Display**: Control which path formats appear in both the context menu and command palette:
  - Show both Windows and Linux/Mac options (default)
  - Show Windows options only
  - Show Linux/Mac options only
- **Show Absolute Path Option** (Desktop only): Toggle whether the absolute path copy option appears in menus
- **Show Notifications**: Toggle success notifications on/off

## Development

### Prerequisites
- Node.js 16+ 
- npm or yarn

### Setup
```bash
# Clone the repository
git clone https://github.com/ckelsoe/obsidian-shell-path-copy.git

# Navigate to the src directory
cd obsidian-shell-path-copy

# Install dependencies
npm install

# Start development build with auto-reload
npm run dev
```

### Building
```bash
# Build for production
npm run build
```

### Code Quality
This plugin uses ESLint for code quality. Run linting with:
```bash
npm run lint
```

## Contributing

I welcome feature requests and bug reports! Please open an issue on the [GitHub repository](https://github.com/ckelsoe/obsidian-shell-path-copy/issues) to discuss any changes or ideas.

If you are interested in contributing code, please open an issue to discuss the feature first. This helps ensure that your work aligns with the project's goals and standards.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

-   Inspired by the need for better file path handling when working with AI coding assistants
-   Built with the [Obsidian API](https://github.com/obsidianmd/obsidian-api)
-   A special thank you to the Obsidian developers for creating such a powerful and extensible product. This plugin would not be possible without their incredible work.
-   Thanks to the Obsidian community for their support and feedback

## Support

If you find this plugin helpful, consider:
- ⭐ Starring the repository on GitHub
- 🐛 Reporting bugs or suggesting features via [GitHub Issues](https://github.com/ckelsoe/obsidian-shell-path-copy/issues)
- 💬 Sharing feedback in the Obsidian Discord server

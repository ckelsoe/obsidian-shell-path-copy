# Shell Path Copy for Obsidian

[![CI](https://img.shields.io/github/actions/workflow/status/ckelsoe/obsidian-shell-path-copy/ci.yml?branch=main&label=CI&logo=github)](https://github.com/ckelsoe/obsidian-shell-path-copy/actions/workflows/ci.yml) [![Release](https://img.shields.io/github/actions/workflow/status/ckelsoe/obsidian-shell-path-copy/release.yml?label=Release&logo=github)](https://github.com/ckelsoe/obsidian-shell-path-copy/actions/workflows/release.yml) [![GitHub Downloads](https://img.shields.io/github/downloads/ckelsoe/obsidian-shell-path-copy/total?logo=github&label=Downloads)](https://github.com/ckelsoe/obsidian-shell-path-copy/releases) [![GitHub Stars](https://img.shields.io/github/stars/ckelsoe/obsidian-shell-path-copy?style=flat&logo=github&label=Stars)](https://github.com/ckelsoe/obsidian-shell-path-copy) [![Obsidian](https://img.shields.io/badge/Obsidian-v0.15.0%2B-7C3AED?logo=obsidian&logoColor=white)](https://obsidian.md) [![License](https://img.shields.io/github/license/ckelsoe/obsidian-shell-path-copy)](https://github.com/ckelsoe/obsidian-shell-path-copy/blob/main/LICENSE) [![Latest Release](https://img.shields.io/github/v/release/ckelsoe/obsidian-shell-path-copy?label=Latest)](https://github.com/ckelsoe/obsidian-shell-path-copy/releases/latest)

An Obsidian plugin for copying file and folder paths with shell-friendly formatting.

## Why this plugin?

Today's workflows often involve using Obsidian alongside terminal-based AI assistants, such as Claude Code or Gemini CLI. You might be using Obsidian on Windows, macOS, Linux, or even on mobile devices like iPads and Android tablets (which can run both Obsidian and terminal apps). Regardless of your setup (Obsidian on Windows with a WSL terminal, Obsidian on your iPad connected to a remote Linux server, or any other combination), you face the same challenge: copying file paths from Obsidian that work correctly in your target terminal environment.

In these scenarios, you need to copy file paths from your vault for use in shell commands or AI assistant prompts. Obsidian's native "Copy file path" command is buried in the command palette and only provides a single path format, which may not match your target system's requirements.

**Shell Path Copy** improves this workflow by:

1. Adding path copying options directly to the **right-click context menu** in the file explorer.
2. Providing **both Linux/macOS and Windows path formats**, ensuring you can get the correct format for your target environment, regardless of the device you are using.

## Features

Shell Path Copy offers a comprehensive set of features designed to streamline your workflow, all of which are configurable via its dedicated settings tab.

* **Right-click menu integration**: adds path copy options to files and folders in the file explorer.
* **Command palette integration**: direct commands for each path format, respecting your display preferences.
* **Multiple path formats**:
   * **Relative paths**: relative to the vault root (desktop and mobile):
      * Windows: `\doc\file.md`
      * Linux and macOS: `/doc/file.md`
   * **Absolute path**: relative to the root of the filesystem (desktop only):
      * Windows: `C:\Users\YourName\Documents\Obsidian\MyVault\doc\file.md`
      * Linux and macOS: `/home/user/Documents/Obsidian/MyVault/doc/file.md`
   * **File URL format** (desktop only):
      * Windows: `file:///C:/Users/YourName/Documents/Obsidian/MyVault/doc/file.md`
      * Linux and macOS: `file:///home/user/Documents/Obsidian/MyVault/doc/file.md`
      * Automatically handles platform-specific formatting.
      * URL-encodes special characters for compatibility.
   * **Obsidian URL format**:
      * `obsidian://open?vault=MyVault&file=doc/file`
      * Works on all platforms (desktop and mobile).
      * Useful for cross-linking from other applications.
   * **Markdown link format**:
      * Wiki-style: `[[filename]]` (default, ideal for Obsidian).
      * Standard Markdown: `[filename.md](/path/filename.md)` (universal compatibility).
   * **Filename only**:
      * Without extension: `my notes`
      * With extension: `my notes.md`
      * Optional path wrapping (off by default for easy pasting in emails and chat).
* **Configurable display options**: choose which path formats appear in menus:
   * Show both Windows and Linux/macOS options (default).
   * Show Windows options only.
   * Show Linux/macOS options only.
* **Smart path wrapping**: automatically wraps paths using configurable delimiters to handle spaces properly:
   * None: `path/to/file`
   * Double quotes: `"path/to/file"`
   * Single quotes: `'path/to/file'`
   * Backticks: `` `path/to/file` `` (default; recommended for paths with spaces).
* **Custom formats**: define your own copy formats as token templates (e.g. `<filename> -> <obsidian-url>`). Each one becomes its own menu item and command. See [Custom formats](#custom-formats) below.
* **Success notifications**: visual feedback when paths are copied.

## Installation

### From Obsidian Community Plugins (recommended)

1. Open Obsidian settings.
2. Navigate to **Community plugins**.
3. Click **Browse** to open the Community Plugins browser.
4. Search for **Shell Path Copy**.
5. Click **Install**, then **Enable**.

### Manual installation

1. Download `main.js`, `manifest.json`, and `styles.css` from the [latest release](https://github.com/ckelsoe/obsidian-shell-path-copy/releases/latest).
2. Create a folder named `shell-path-copy` in your vault's `.obsidian/plugins/` directory.
3. Copy the downloaded files into this folder.
4. Reload Obsidian.
5. Enable **Shell Path Copy** in Settings → Community plugins.

### BRAT (optional, for pre-release testing)

BRAT lets power users install pre-release builds before they hit the Community Plugins marketplace. Use it if you want to try a release candidate, beta feature, or bug-fix PR ahead of the official release. Regular users should install from Community Plugins instead.

1. Install the **BRAT** plugin from Community Plugins.
2. Open BRAT settings and click **Add Beta Plugin**.
3. Enter: `https://github.com/ckelsoe/obsidian-shell-path-copy`
4. Click **Add Plugin**.
5. Enable **Shell Path Copy** in Settings → Community plugins.

## Usage

Shell Path Copy provides flexible ways to copy paths.

### From the file explorer context menu (right-click)

1. Right-click any file or folder in the Obsidian file explorer.
2. Choose your desired format:
   * **Copy relative Linux/macOS path**: for Unix/Linux/macOS systems (e.g. `/folder/file.md`).
   * **Copy relative Windows path**: for Windows systems (e.g. `\folder\file.md`).
   * **Copy absolute Linux/macOS path** / **Copy absolute Windows path**: full system path (desktop only; wording matches the host OS).
   * **Copy as file:// URL**: file URL format (desktop only).
   * **Copy as Obsidian URL**: `obsidian://` protocol link.
   * **Copy as Markdown link**: for documentation and note-taking (e.g. `[[filename]]` or `[filename.md](path)`).
   * **Copy filename**: just the filename without extension.
   * **Copy filename with extension**: the filename with its extension.
3. The path is copied to your clipboard, wrapped in backticks by default.
4. Paste it anywhere you need.

### From the command palette (Ctrl/Cmd+P)

1. Open the command palette (Ctrl/Cmd+P).
2. Type **Shell Path Copy** or **Copy** to filter commands.
3. Available commands depend on your settings:
   * `Shell Path Copy: Copy as Linux/macOS path` (shown when set to **both** or **Linux/macOS only**).
   * `Shell Path Copy: Copy as Windows path` (shown when set to **both** or **Windows only**).
   * `Shell Path Copy: Copy as absolute Windows path` / `Copy as absolute Linux/macOS path` (desktop only; wording matches the host OS).
   * `Shell Path Copy: Copy as file:// URL` (desktop only).
   * `Shell Path Copy: Copy as Obsidian URL` (when enabled in settings).
   * `Shell Path Copy: Copy as Markdown link` (when enabled in settings).
   * `Shell Path Copy: Copy filename` (when enabled in settings).
   * `Shell Path Copy: Copy filename with extension` (when enabled in settings).
4. The path of the currently active file (or focused file in the explorer) is copied.

## Example: the remote workflow

Imagine you are viewing `My-Project-Plan.md` in Obsidian on your iPad. You are connected to your Linux development server using an SSH client like **Termius**. You need to tell a colleague (or an AI assistant like Gemini) to view the contents of that file on the server.

With Shell Path Copy:

1. In Obsidian on your iPad, **right-click** on `My-Project-Plan.md`.
2. Select **Copy relative Linux/macOS path**.
3. The string `` `/My-Project-Plan.md` `` is now on your clipboard.
4. Paste it directly into your Termius session: `` cat `/My-Project-Plan.md` ``

No manual editing, no mistakes, no context switching. It just works.

## File URL format (desktop only)

For desktop users who need to create clickable `file://` URLs:

1. Right-click any file or folder in the file explorer.
2. Select **Copy as file:// URL**.
3. The full `file://` URL is copied to your clipboard.

This is particularly useful for:

* Creating clickable links in browsers.
* Working with applications that accept `file://` URLs.
* Documentation that needs absolute file references.
* Opening files in external applications via URLs.

Example outputs:

* **Windows**: `file:///C:/Users/John/Documents/vault/note.md`
* **Linux**: `file:///home/john/Documents/vault/note.md`
* **macOS**: `file:///Users/john/Documents/vault/note.md`

## Obsidian URL format

For users who want to create clickable links that open files directly in Obsidian:

1. Right-click any file in the file explorer.
2. Select **Copy as Obsidian URL**.
3. The full `obsidian://` URL is copied to your clipboard.

This is particularly useful for:

* Creating links from task managers (Todoist, OmniFocus, etc.).
* Linking from external documentation or wikis.
* Building automation workflows.
* Cross-app integration.

Example output:

* `obsidian://open?vault=MyVault&file=Projects/Project%20Plan`

## Markdown link format

For users who want to create internal links or documentation:

1. Right-click any file in the file explorer.
2. Select **Copy as Markdown link**.
3. Choose your preferred format in settings:
   * **Wiki-style** (default): `[[My Document]]`, ideal for Obsidian internal linking.
   * **Standard Markdown**: `[My Document.md](/folder/My Document.md)`, universal Markdown compatibility.

This is particularly useful for:

* Creating internal note references in Obsidian.
* Documentation that uses Markdown formatting.
* Cross-referencing files in project notes.
* Building linked knowledge bases.

## Custom formats

If the built-in formats do not match what you need, define your own. A custom format is a template string containing tokens that the plugin substitutes from the file you copy.

1. Open Settings → Community plugins → Shell Path Copy → Options.
2. Scroll to **Custom formats** and click **Add custom format**.
3. Give it a name and a template, for example `<filename> -> <obsidian-url>`.
4. The settings panel shows a live preview as you type, plus badges warning you when a token will not work on mobile or needs the file open in the editor.
5. Reload Obsidian so the new command registers. Your format then appears in the right-click menu and command palette.

Example templates:

* `<filename> -> <obsidian-url>` → `My file -> obsidian://open?vault=assorted&file=My%20file`
* `<filename-ext>#L<line-number>` → `My file.md#L42`
* `cat <relative-path-windows>` → `cat .\folder\My file.md`

Each format has its own wrapping option (none, quotes, backticks) and toggles for whether it appears in the menu and command palette. The full list of tokens, with examples and fallback behavior, is in [`token-usage.md`](./token-usage.md).

## Compatibility with Notebook Navigator

[Notebook Navigator](https://github.com/johansan/notebook-navigator) is a popular plugin that replaces Obsidian's default file explorer with an enhanced interface. If you use Notebook Navigator, you'll find that it includes some built-in path copying functionality.

### Feature comparison

| Feature | Shell Path Copy | Notebook Navigator |
|---------|----------------|-------------------|
| Copy vault-relative path | ✅ Linux/macOS & Windows formats | ✅ Single format |
| Copy absolute path | ✅ With configurable wrapping | ✅ Without wrapping |
| Copy file:// URL | ✅ | ❌ |
| Copy Obsidian URL | ✅ | ✅ |
| Copy Markdown link | ✅ Wiki-style & standard | ❌ |
| Copy filename only | ✅ With/without extension | ❌ |
| Configurable path wrapping | ✅ (backticks, quotes, none) | ❌ |
| Platform-specific formats | ✅ (Windows vs Linux/macOS) | ❌ |

### Using Shell Path Copy with Notebook Navigator

Shell Path Copy's context menu items only appear in Obsidian's native file explorer. However, you can still access all functionality through the command palette (`Ctrl/Cmd+P`):

* `Shell Path Copy: Copy as Linux/macOS path`
* `Shell Path Copy: Copy as Windows path`
* `Shell Path Copy: Copy as absolute Windows path` / `Copy as absolute Linux/macOS path`
* `Shell Path Copy: Copy as file:// URL`
* `Shell Path Copy: Copy as Obsidian URL`
* `Shell Path Copy: Copy as Markdown link`
* `Shell Path Copy: Copy filename`
* `Shell Path Copy: Copy filename with extension`

These commands work on the currently active file or the focused file in either file explorer.

### Future integration

We have no current plans to integrate directly with Notebook Navigator's context menus. If you would like to see deeper integration between these plugins, please [open an issue](https://github.com/ckelsoe/obsidian-shell-path-copy/issues) describing your use case. We'll consider investigating integration options if there is sufficient community interest.

## Example use cases

* Sharing file locations with AI assistants like Claude Code or Gemini CLI.
* Creating internal note references and linked knowledge bases.
* Documenting file structures in notes.
* Creating file references in technical documentation.
* Quick file path sharing in team communications.

## Settings

Access plugin settings via Settings → Community plugins → Shell Path Copy → Options.

The settings tab is organized into several sections.

**Path wrapping**: choose how paths are wrapped when copied to the clipboard (none, double quotes, single quotes, or backticks).

**Menu display**: control which path formats appear in both the context menu and command palette:

* Show both Windows and Linux/macOS options (default).
* Show Windows options only.
* Show Linux/macOS options only.

**Show notifications**: toggle success notifications on or off.

### Paths (desktop only)

* **Show absolute path option**: toggle whether the absolute path copy option appears in menus.
* **Show file:// URL option**: toggle whether the `file://` URL copy option appears in menus.

### Links

* **Show Obsidian URL option**: toggle whether the Obsidian URL copy option appears in menus.
* **Show Markdown link option**: toggle whether the Markdown link copy option appears in menus.
* **Markdown link format**: choose between wiki-style (`[[filename]]`) and standard Markdown (`[filename](path)`) formats. Only shown when the Markdown link option is enabled.

### Filenames

* **Show filename option**: toggle whether the copy filename (without extension) option appears in menus.
* **Show filename with extension option**: toggle whether the copy filename (with extension) option appears in menus.
* **Apply path wrapping to filenames**: when enabled, filenames use the same wrapping as paths (off by default).

### Custom formats

* **Add custom format**: create a token-template format. Each format has a name, template, wrapping option, and toggles for menu and command palette visibility. See [Custom formats](#custom-formats) above.
* **Notify when a token could not be resolved**: show a notice when a desktop-only or editor-only token is left blank.

## Contributing

Bug reports and feature requests are welcome via [GitHub Issues](https://github.com/ckelsoe/obsidian-shell-path-copy/issues). For local build, test, and pull request guidelines, see [`CONTRIBUTING.md`](./CONTRIBUTING.md).

## Privacy

Shell Path Copy collects no data, stores nothing outside your own vault, and contains no network code. It reads a path you select and places it on your clipboard, nothing more. See [PRIVACY.md](./PRIVACY.md) for the full privacy policy and liability disclaimer, and [SECURITY.md](./SECURITY.md) for the security policy.

## License

This project is licensed under the MIT License. See the [LICENSE](./LICENSE) file for details.

## Acknowledgments

* Inspired by the need for better file path handling when working with AI coding assistants.
* Built for [Obsidian](https://obsidian.md) using the [Obsidian API](https://github.com/obsidianmd/obsidian-api).
* A special thank you to the Obsidian developers for creating such a powerful and extensible product. This plugin would not be possible without their incredible work.
* Thanks to the Obsidian community for their support and feedback.

## Support

If you find this plugin helpful, consider:

* ⭐ Starring the repository on GitHub.
* Reporting bugs or suggesting features via [GitHub Issues](https://github.com/ckelsoe/obsidian-shell-path-copy/issues).

# Shell Path Copy for Obsidian

[![CI](https://img.shields.io/github/actions/workflow/status/ckelsoe/obsidian-shell-path-copy/ci.yml?branch=main&label=CI&logo=github)](https://github.com/ckelsoe/obsidian-shell-path-copy/actions/workflows/ci.yml) [![Release](https://img.shields.io/github/actions/workflow/status/ckelsoe/obsidian-shell-path-copy/release.yml?label=Release&logo=github)](https://github.com/ckelsoe/obsidian-shell-path-copy/actions/workflows/release.yml) [![GitHub Downloads](https://img.shields.io/github/downloads/ckelsoe/obsidian-shell-path-copy/total?logo=github&label=Downloads)](https://github.com/ckelsoe/obsidian-shell-path-copy/releases) [![GitHub Stars](https://img.shields.io/github/stars/ckelsoe/obsidian-shell-path-copy?style=flat&logo=github&label=Stars)](https://github.com/ckelsoe/obsidian-shell-path-copy) [![Obsidian](https://img.shields.io/badge/Obsidian-v0.15.0%2B-7C3AED?logo=obsidian&logoColor=white)](https://obsidian.md) [![License](https://img.shields.io/github/license/ckelsoe/obsidian-shell-path-copy)](https://github.com/ckelsoe/obsidian-shell-path-copy/blob/main/LICENSE) [![Latest Release](https://img.shields.io/github/v/release/ckelsoe/obsidian-shell-path-copy?label=Latest)](https://github.com/ckelsoe/obsidian-shell-path-copy/releases/latest)

Copy file and folder paths from your Obsidian vault in whatever format you need: shell paths, URLs, Markdown links, or your own custom formats built from tokens.

## Why this plugin?

Modern workflows mix Obsidian with terminals and AI assistants like Claude Code or Gemini CLI. You might run Obsidian on Windows with a WSL terminal, or on an iPad connected to a remote Linux server. In every case you face the same task: get a path out of your vault and into a shell command, a prompt, or a document, in the format that target expects.

Obsidian's native "Copy file path" command is buried in the command palette and gives a single format. Shell Path Copy puts copy actions in the right-click menu and the command palette, and lets every format be exactly what you want.

## What it does

- **Token templates.** Every copy format is a small template such as `<filename> -> <obsidian-url>`. The plugin fills the tokens from the file you copy.
- **Ready-made formats.** It ships with formats for relative paths, absolute paths, `file://` URLs, Obsidian URLs, Markdown links, and filenames, plus two example templates. Four are enabled out of the box; the rest are one toggle away.
- **Fully customizable.** Rename, re-icon, reorder, edit, disable, delete any format, and add as many of your own as you like.
- **Right-click menu and command palette.** Each enabled format can appear in either, both, or neither.
- **Desktop and mobile.** Works on both. A few tokens are desktop-only; the settings panel tells you which.

## Installation

### From Obsidian Community Plugins (recommended)

1. Open Obsidian settings.
2. Go to **Community plugins**.
3. Click **Browse**.
4. Search for **Shell Path Copy**.
5. Click **Install**, then **Enable**.

### Manual installation

1. Download `main.js`, `manifest.json`, and `styles.css` from the [latest release](https://github.com/ckelsoe/obsidian-shell-path-copy/releases/latest).
2. Create a folder named `shell-path-copy` in your vault's `.obsidian/plugins/` directory.
3. Copy the three files into it.
4. Reload Obsidian.
5. Enable **Shell Path Copy** in Settings → Community plugins.

### BRAT (optional, for pre-release testing)

BRAT installs pre-release builds before they reach the Community Plugins marketplace. Regular users should install from Community Plugins instead.

1. Install the **BRAT** plugin from Community Plugins.
2. Open BRAT settings and click **Add Beta Plugin**.
3. Enter `https://github.com/ckelsoe/obsidian-shell-path-copy`.
4. Click **Add Plugin**.
5. Enable **Shell Path Copy** in Settings → Community plugins.

## Quick start

You can copy from three places:

- **Right-click a file or folder** in the file explorer.
- **Right-click inside an open note.** The formats act on that note, and the heading-aware formats link to the heading your cursor is in.
- **Command palette** (`Ctrl/Cmd+P`): type `Copy:` and pick a format. It acts on the active file.

Pick a format from the Shell Path Copy section of the menu; the result lands on your clipboard.

Out of the box four formats are enabled: Relative Linux/macOS path, Relative Windows path, Obsidian URL, and Markdown link. Open the settings to enable the others or add your own.

## Built-in formats

These formats are seeded into every vault. Enable, edit, or delete any of them in settings.

| Format | Template | Example result |
|---|---|---|
| Relative Linux/macOS path | `<relative-path-unix>` | `` `./folder/file.md` `` |
| Relative Windows path | `<relative-path-windows>` | `` `.\folder\file.md` `` |
| Absolute path | `<absolute-path>` | `` `C:\Users\you\vault\folder\file.md` `` |
| file:// URL | `<file-url>` | `file:///C:/Users/you/vault/folder/file.md` |
| Obsidian URL | `<obsidian-url>` | `obsidian://open?vault=MyVault&file=folder%2Ffile` |
| Markdown link | `<markdown-link>` | `[[file]]` |
| Filename | `<filename>` | `file` |
| Filename with extension | `<filename-ext>` | `file.md` |

Four more formats ship disabled, ready to enable or copy from:

| Format | Template | Example result |
|---|---|---|
| Example: name and Obsidian URL | `<filename> -> <obsidian-url>` | `file -> obsidian://open?vault=MyVault&file=folder%2Ffile` |
| Example: line reference | `<filename-ext>#L<line-number>` | `file.md#L42` |
| Obsidian URL (to heading) | `<obsidian-url-section>` | `obsidian://open?vault=MyVault&file=folder%2Ffile%23Notes` |
| Wiki link (to heading) | `<wikilink-section>` | `[[file#Notes]]` |

The two "to heading" formats link to the heading your cursor is in when a note is open, and to the file otherwise. They are the way to get an Obsidian link that jumps to a section. Absolute path and file:// URL are desktop-only; on mobile they produce nothing.

## Custom formats

A custom format is a token template. Build one in settings:

1. Open Settings → Community plugins → Shell Path Copy → Options.
2. In **Custom formats**, click **Add custom format**, or click any existing format to expand its editor.
3. Set the fields:
   - **Name**: shown in the menu and command palette.
   - **Icon**: the icon shown next to the format in the menu.
   - **Template**: the token template. The token palette below the field inserts a token at the cursor. A live preview shows the rendered result, and a Desktop / Mobile row shows where the template works.
   - **Wrapping**: none, double quotes, single quotes, or backticks, applied around the whole result.
   - **Show in menu** and **Show in command palette**: where the format appears.
4. Reload Obsidian so the command registers.

The format list is compact and drag-to-reorder; list order is the menu order. Click a format to expand its editor.

### Tokens

A token is a name in angle brackets. Unknown tokens are left as typed. Escape a literal bracket with a backslash (`\<`).

| Token | Resolves to | Availability |
|---|---|---|
| `<filename>` | Name without the final extension | All |
| `<filename-ext>` | Full name with extension | All |
| `<extension>` | Extension without the dot | All |
| `<relative-path>` | Vault-relative path, host OS style | All |
| `<relative-path-unix>` | Vault-relative path, Linux/macOS style | All |
| `<relative-path-windows>` | Vault-relative path, Windows style | All |
| `<absolute-path>` | Full filesystem path | Desktop only |
| `<file-url>` | `file://` URL | Desktop only |
| `<obsidian-url>` | `obsidian://open` deep link | All |
| `<vault-name>` | Vault name, raw | All |
| `<vault-name-encoded>` | Vault name, URL-encoded | All |
| `<markdown-link>` | Markdown link in the configured format | All |
| `<wikilink>` | Wiki-style link | All |
| `<date>` | Current date, `YYYY-MM-DD` | All |
| `<time>` | Current time, `HH:mm` | All |
| `<line-number>` | Active editor cursor line | Editor only |
| `<heading>` | Heading the cursor sits under | Editor only |
| `<obsidian-url-section>` | Obsidian URL to the cursor heading, or the file when there is none | All |
| `<wikilink-section>` | Wiki link to the cursor heading, or the file when there is none | All |
| `<nl>` | A literal newline | All |

"Desktop only" tokens are blank on mobile. The "editor only" token fills in only when the file you copy is the file open in the editor. The settings preview flags both cases as you build a template.

The full token reference, with worked examples and fallback behavior, is in [`token-usage.md`](./token-usage.md).

## Settings

Open Settings → Community plugins → Shell Path Copy → Options.

Global options:

- **Show notifications**: show a notice when something is copied.
- **Markdown link format**: wiki-style (`[[filename]]`) or standard Markdown (`[filename](path)`). Used by the `<markdown-link>` token.
- **Notify when a token could not be resolved**: show a notice when a desktop-only or editor-only token is left blank.

Everything else is per format, in the Custom formats list.

## Using a custom file explorer

Shell Path Copy's right-click items appear in Obsidian's native file explorer. If you use a plugin that replaces the file explorer, such as [Notebook Navigator](https://github.com/johansan/notebook-navigator), those menu items will not show there. Every format is still available through the command palette (`Ctrl/Cmd+P`), which works on the active file regardless of which explorer you use.

## Example workflows

**Remote terminal.** You are viewing `My-Project-Plan.md` in Obsidian on an iPad, connected to a Linux server over SSH. Right-click the file, choose Relative Linux/macOS path, and paste `` `/My-Project-Plan.md` `` straight into your terminal session.

**AI assistant line reference.** Enable the Line reference example format. With a note open at the line you care about, run it to copy `My-Project-Plan.md#L42`, ready to drop into a prompt for Claude Code or Gemini CLI.

**Cross-app links.** Use the Obsidian URL format to create links that open a note directly in Obsidian from a task manager, a wiki, or an automation tool.

## Contributing

Bug reports and feature requests are welcome via [GitHub Issues](https://github.com/ckelsoe/obsidian-shell-path-copy/issues). For local build, test, and pull request guidelines, see [`CONTRIBUTING.md`](./CONTRIBUTING.md).

## Privacy

Shell Path Copy collects no data, stores nothing outside your own vault, and contains no network code. It reads a path you select and places it on your clipboard, nothing more. See [PRIVACY.md](./PRIVACY.md) for the full privacy policy and liability disclaimer, and [SECURITY.md](./SECURITY.md) for the security policy.

## License

This project is licensed under the MIT License. See the [LICENSE](./LICENSE) file for details.

## Acknowledgments

- Inspired by the need for better file path handling when working with AI coding assistants.
- Built for [Obsidian](https://obsidian.md) using the [Obsidian API](https://github.com/obsidianmd/obsidian-api).
- Thanks to the Obsidian developers and community.

## Support

If you find this plugin helpful, consider:

- Starring the repository on GitHub.
- Reporting bugs or suggesting features via [GitHub Issues](https://github.com/ckelsoe/obsidian-shell-path-copy/issues).

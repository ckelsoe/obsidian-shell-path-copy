# Token reference for custom formats

Custom formats are template strings. The plugin substitutes any `<token>` with a value
derived from the file you copy. Anything that is not a recognized token is left as typed.

## Worked example

Every output on this page is computed against this fixed scenario:

- Vault name: `assorted`
- File copied: `Notes/My file.md` (display name `My file.md`)
- Host: desktop, Windows, vault stored at `C:\Users\name\assorted`
- The copied file is open in the editor with the cursor on line 42, under the heading "Project notes"
- Date/time when copied: `2026-05-17`, `14:30`

## Every token

| Token | Description | Tier | Output for the example |
|---|---|---|---|
| `<filename>` | Name without the final extension | universal | `My file` |
| `<filename-ext>` | Full name with extension | universal | `My file.md` |
| `<extension>` | Extension without the dot (empty for folders) | universal | `md` |
| `<relative-path>` | Vault-relative path in the host OS style (`\` on Windows, `/` on Mac/Linux) | universal | `.\Notes\My file.md` |
| `<relative-path-unix>` | Vault-relative path, Linux/macOS style | universal | `./Notes/My file.md` |
| `<relative-path-windows>` | Vault-relative path, Windows style | universal | `.\Notes\My file.md` |
| `<absolute-path>` | Full filesystem path, host-OS style | desktop only | `C:\Users\name\assorted\Notes\My file.md` |
| `<file-url>` | `file://` URL, per-segment URL-encoded | desktop only | `file:///C:/Users/name/assorted/Notes/My%20file.md` |
| `<obsidian-url>` | `obsidian://open` deep link, URL-encoded | universal | `obsidian://open?vault=assorted&file=Notes%2FMy%20file` |
| `<vault-name>` | Vault name, raw / unencoded | universal | `assorted` |
| `<vault-name-encoded>` | Vault name, URL-encoded | universal | `assorted` |
| `<markdown-link>` | Markdown link in the format chosen in settings | universal | `[[My file]]` (wiki) or `[My file.md](./Notes/My file.md)` (standard) |
| `<wikilink>` | Wiki-style link, always | universal | `[[My file]]` |
| `<date>` | Current date, `YYYY-MM-DD` | universal | `2026-05-17` |
| `<time>` | Current time, `HH:mm` | universal | `14:30` |
| `<line-number>` | Active editor cursor line, 1-based | editor only | `42` |
| `<heading>` | Heading the cursor sits under | editor only | `Project notes` |
| `<obsidian-url-section>` | Obsidian URL to the cursor heading, or the file when there is none | universal | `obsidian://open?vault=assorted&file=Notes%2FMy%20file&heading=Project%20notes` |
| `<wikilink-section>` | Wiki link to the cursor heading, or the file when there is none | universal | `[[My file#Project notes]]` |
| `<nl>` | A literal newline | universal | (line break) |

Tier meaning: **universal** always resolves; **desktop only** is blank on mobile;
**editor only** is blank unless the copied file is the file open in the editor.

## Templates in action

| Template | Output |
|---|---|
| `<filename> -> <obsidian-url>` | `My file -> obsidian://open?vault=assorted&file=Notes%2FMy%20file` |
| `<filename-ext>#L<line-number>` | `My file.md#L42` |
| `<relative-path-unix>:<line-number>` | `./Notes/My file.md:42` |
| `cat <relative-path-windows>` | `cat .\Notes\My file.md` |
| `[<filename>](<file-url>)` | `[My file](file:///C:/Users/name/assorted/Notes/My%20file.md)` |
| `# <filename><nl>Path: <relative-path>` | `# My file` then a new line `Path: .\Notes\My file.md` (host is Windows) |

Per-format wrapping (set per custom format) is applied around the whole result after
substitution. With backtick wrapping, `<relative-path-unix>` yields `` `./Notes/My file.md` ``.

## Escaping

To output a literal `<` or `>` or `\`, escape it with a backslash.

| Template | Output |
|---|---|
| `\<filename\>` | `<filename>` |
| `<filename> \<tag\>` | `My file <tag>` |
| `a\\b` | `a\b` |

## Encoding: raw vs encoded tokens

- **Raw text** (no encoding): `<filename>`, `<filename-ext>`, `<extension>`,
  `<relative-path>`, `<relative-path-unix>`, `<relative-path-windows>`, `<absolute-path>`,
  `<vault-name>`, `<date>`, `<time>`, `<line-number>`, `<heading>`, `<wikilink-section>`.
- **URL-encoded**: `<file-url>` (each path segment), `<obsidian-url>` (vault and file),
  `<obsidian-url-section>` (vault, file, and heading), `<vault-name-encoded>`.

If you hand-build a URL, use the encoded tokens. Example: a vault named `My Vault` makes
`<vault-name>` produce `My Vault` but `<vault-name-encoded>` produce `My%20Vault`.

## Fallback behavior

- On mobile, `<absolute-path>` and `<file-url>` resolve to an empty string.
- `<line-number>` and `<heading>` resolve to an empty string when no note is open, or when
  the file you copied is not the file currently open in the editor.
- `<obsidian-url-section>` and `<wikilink-section>` never blank: with a heading they link to
  it, otherwise they link to the file. They are the way to get an Obsidian link that jumps
  to the heading your cursor is in.
- When a token blanks out this way and "Notify when a token could not be resolved" is on,
  a notice explains which token was unavailable. The rest of the template still copies.
- An unrecognized token such as `<bogus>` is left in the output verbatim as `<bogus>`, so
  typos are visible rather than silently dropped.

## Folders

Folders have no extension. `<extension>` is empty and `<filename>` equals `<filename-ext>`.
`<obsidian-url>` for a folder produces a link that will not open a note.

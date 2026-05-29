# Token reference for custom formats

You do not need this to use the plugin. The built-in formats copy paths and links
without any tokens. This reference is for when you want to build your own format.

Custom formats are template strings. The plugin substitutes any `<token>` with a value
derived from the file you copy. Anything that is not a recognized token is left as typed.

## Worked example

Every output on this page is computed against this fixed scenario:

- Vault name: `assorted`
- File copied: `Notes/My file.md` (display name `My file.md`)
- Host: desktop, Windows, vault stored at `C:\Users\name\assorted`
- The copied file is open in the editor with the cursor on line 42, under the heading "Project notes", in a block whose id is `a1b2c3`
- A selection in that editor spans lines 42 through 58
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
| `<line-start>` | First line of the editor selection, 1-based | editor only | `42` |
| `<line-end>` | Last line of the editor selection, 1-based | editor only | `58` |
| `<line-range>` | Selected line range; a single line when nothing is selected | editor only | `42-58` |
| `<heading>` | Heading the cursor sits under | editor only | `Project notes` |
| `<obsidian-url-heading>` | Obsidian URL to the cursor heading, or the file when there is none | universal | `obsidian://open?vault=assorted&file=Notes%2FMy%20file%23Project%20notes` |
| `<wikilink-heading>` | Wiki link to the cursor heading, or the file when there is none | universal | `[[My file#Project notes]]` |
| `<block-id>` | Block id at the cursor, created if needed | editor only | `a1b2c3` |
| `<obsidian-url-block>` | Obsidian URL to the cursor block, or the file when there is none | universal | `obsidian://open?vault=assorted&file=Notes%2FMy%20file%23%5Ea1b2c3` |
| `<wikilink-block>` | Wiki link to the cursor block, or the file when there is none | universal | `[[My file#^a1b2c3]]` |
| `<nl>` | A literal newline | universal | (line break) |

Tier meaning: **universal** always resolves; **desktop only** is blank on mobile;
**editor only** is blank unless the copied file is the file open in the editor.

## Templates in action

| Template | Output |
|---|---|
| `<filename> -> <obsidian-url>` | `My file -> obsidian://open?vault=assorted&file=Notes%2FMy%20file` |
| `<filename-ext>#L<line-number>` | `My file.md#L42` |
| `<filename-ext> Line <line-number>` | `My file.md Line 42` |
| `<relative-path-unix>:<line-number>` | `./Notes/My file.md:42` |
| `<filename-ext>#L<line-range>` | `My file.md#L42-58` |
| `<absolute-path>#L<line-range>` | `C:\Users\name\assorted\Notes\My file.md#L42-58` |
| `<filename-ext> lines <line-start>-<line-end>` | `My file.md lines 42-58` |
| `cat <relative-path-windows>` | `cat .\Notes\My file.md` |
| `[<filename>](<file-url>)` | `[My file](file:///C:/Users/name/assorted/Notes/My%20file.md)` |
| `# <filename><nl>Path: <relative-path>` | `# My file` then a new line `Path: .\Notes\My file.md` (host is Windows) |

Per-format wrapping (set per custom format) is applied around the whole result after
substitution. With backtick wrapping, `<relative-path-unix>` yields `` `./Notes/My file.md` ``.

## Line references and what reads them

`<line-number>`, `<line-start>`, `<line-end>`, and `<line-range>` produce plain line
numbers. `<line-range>` is the convenient one: it copies `42-58` for a multi-line
selection and just `42` when nothing is selected.

These tokens are a text reference, not an Obsidian link. Obsidian itself cannot
navigate to a line. An Obsidian `#` anchor only resolves to a heading (`#Heading`) or a
block (`#^block-id`); it has no concept of a line number. So a string like
`My file.md#L42-58` will not jump anywhere if you click it inside Obsidian. For
in-Obsidian navigation use the heading or block tokens instead.

Where line references do work is as input to a tool that opens the file and reads it,
for example an AI coding agent. For that case pair the line tokens with `<absolute-path>`,
not the bare filename. A bare `My file.md#L42-58` gives the agent no location, so it has
to search for the file first. `<absolute-path>#L<line-range>` gives a full path the agent
can open directly:

```
<absolute-path>#L<line-range>   ->   C:\Users\name\assorted\Notes\My file.md#L42-58
```

`<relative-path-unix>` also works when the agent's working directory is the vault root.

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
  `<vault-name>`, `<date>`, `<time>`, `<line-number>`, `<line-start>`, `<line-end>`,
  `<line-range>`, `<heading>`, `<block-id>`, `<wikilink>`, `<wikilink-heading>`,
  `<wikilink-block>`.
- **URL-encoded**: `<file-url>` (each path segment), `<obsidian-url>` (vault and file),
  `<obsidian-url-heading>` (vault, file, and heading), `<obsidian-url-block>` (vault, file,
  and block), `<vault-name-encoded>`.

If you hand-build a URL, use the encoded tokens. Example: a vault named `My Vault` makes
`<vault-name>` produce `My Vault` but `<vault-name-encoded>` produce `My%20Vault`.

## Fallback behavior

- On mobile, `<absolute-path>` and `<file-url>` resolve to an empty string.
- `<line-number>`, `<line-start>`, `<line-end>`, `<line-range>`, and `<heading>` resolve to
  an empty string when no note is open, or when the file you copied is not the file
  currently open in the editor.
- `<line-start>`, `<line-end>`, and `<line-range>` use the editor selection. With no
  selection all three fall back to the cursor line, so `<line-range>` copies a single
  number. They report whole lines: a selection that starts or ends mid-line still yields
  the line numbers it spans, not character offsets.
- `<obsidian-url-heading>` and `<wikilink-heading>` never blank: with a heading they link to
  it, otherwise they link to the file. They are the way to get an Obsidian link that jumps
  to the heading your cursor is in.
- `<block-id>`, `<obsidian-url-block>`, and `<wikilink-block>` link to the block at the
  cursor. A block needs a `^id` marker; if the block has none, the plugin creates one and
  writes it into the note (this is how Obsidian's own block links work). They support
  paragraphs and list items. With no editor, or on a heading, table, code block, or other
  multi-line construct, the block link tokens fall back to the file.
- When a token blanks out this way and "Notify when a token could not be resolved" is on,
  a notice explains which token was unavailable. The rest of the template still copies.
- An unrecognized token such as `<bogus>` is left in the output verbatim as `<bogus>`, so
  typos are visible rather than silently dropped.

## Folders

Folders have no extension. `<extension>` is empty and `<filename>` equals `<filename-ext>`.

Path and name tokens (`<filename>`, `<relative-path>`, `<absolute-path>`,
`<file-url>`, and similar) work the same for folders as for files. Tokens that
only make sense for a note do not: `<obsidian-url>` and the other link tokens
(`<wikilink>`, `<markdown-link>`, and the heading/block variants) do not resolve
to a folder, and the editor tokens (`<line-number>`, `<heading>`, `<block-id>`,
and the rest) have no editor to read.

Because of this, a format is offered on folders only when its template uses
folder-safe tokens. A format whose template contains any file-only token is shown
on files only, automatically. You can further limit any folder-safe format to
files, folders, or both with the **Show on** option in its settings editor. This
mirrors Obsidian's own menu, which omits the URL copy entry on folders.

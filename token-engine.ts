import {
	formatRelativePath,
	buildFileUrl,
	buildObsidianUrl,
	buildMarkdownLink,
	extractFilename,
	MarkdownLinkFormat,
} from './path-utils';

// Token engine for user-defined custom copy formats (issue 13).
//
// This module is intentionally free of any Obsidian API dependency. The plugin
// (main.ts) gathers everything a template could need into a plain TokenContext
// and passes it in, which keeps the engine fully unit-testable under Jest with
// no mocking. See token-usage.md for the user-facing token reference.

/** Everything a template can resolve against, assembled by main.ts per copy. */
export interface TokenContext {
	/** file.name, e.g. "My file.md". */
	fileName: string;
	/** file.path, vault-relative with forward slashes, e.g. "Notes/My file.md". */
	filePath: string;
	/** True when the copied item is a folder (no extension). */
	isFolder: boolean;
	/** Vault display name. */
	vaultName: string;
	/** Host OS. Drives the slash style of <relative-path>. */
	isWindows: boolean;
	/** OS-native absolute path, or null on mobile / non-FileSystemAdapter. */
	absolutePath: string | null;
	/** Active editor cursor line (1-based), or null when it does not apply. */
	lineNumber: number | null;
	/** Heading the cursor sits under, or null when there is none / no editor. */
	currentHeading: string | null;
	/** Markdown link style chosen in plugin settings. */
	markdownLinkFormat: MarkdownLinkFormat;
	/** Injected so <date>/<time> are deterministic in tests. */
	now: Date;
}

/**
 * Token availability tier:
 * - universal: always resolves.
 * - desktop:   needs an absolute path; blank on mobile.
 * - editor:    needs the copied file open in the editor; blank otherwise.
 */
export type TokenTier = 'universal' | 'desktop' | 'editor';

export interface TokenDef {
	/** Token name without the angle brackets, e.g. "filename". */
	name: string;
	tier: TokenTier;
	/** One-line description for the settings token hint list. */
	description: string;
	/** Resolves the token. Callers gate desktop/editor tiers before calling. */
	resolve: (ctx: TokenContext) => string;
}

export interface ApplyResult {
	text: string;
	/** A desktop-only token was present but no absolute path was available. */
	usedDesktopTokenOnMobile: boolean;
	/** An editor-only token was present but no matching editor was active. */
	usedEditorTokenWithoutEditor: boolean;
	/** Unrecognized token names found in the template (left verbatim in text). */
	unknownTokens: string[];
}

export interface ValidationIssue {
	kind: 'unknown-token' | 'empty' | 'desktop-only-token' | 'editor-only-token';
	detail: string;
}

function pad2(n: number): string {
	return n < 10 ? '0' + n : String(n);
}

function formatDate(d: Date): string {
	return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function formatTime(d: Date): string {
	return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/** Extension without the leading dot; empty for folders, dotfiles, or no extension. */
function getExtension(fileName: string): string {
	const lastDot = fileName.lastIndexOf('.');
	return lastDot > 0 ? fileName.substring(lastDot + 1) : '';
}

/** The full token vocabulary, in the order shown in the settings hint list. */
export const TOKENS: readonly TokenDef[] = [
	{
		name: 'filename',
		tier: 'universal',
		description: 'Name without the final extension',
		resolve: (ctx) => extractFilename(ctx.fileName, false),
	},
	{
		name: 'filename-ext',
		tier: 'universal',
		description: 'Full name with extension',
		resolve: (ctx) => ctx.fileName,
	},
	{
		name: 'extension',
		tier: 'universal',
		description: 'Extension without the dot (empty for folders)',
		resolve: (ctx) => getExtension(ctx.fileName),
	},
	{
		name: 'relative-path',
		tier: 'universal',
		description: 'Vault-relative path in the host OS style',
		resolve: (ctx) => formatRelativePath(ctx.filePath, ctx.isWindows ? 'windows' : 'unix'),
	},
	{
		name: 'relative-path-unix',
		tier: 'universal',
		description: 'Vault-relative path, Linux/macOS style',
		resolve: (ctx) => formatRelativePath(ctx.filePath, 'unix'),
	},
	{
		name: 'relative-path-windows',
		tier: 'universal',
		description: 'Vault-relative path, Windows style',
		resolve: (ctx) => formatRelativePath(ctx.filePath, 'windows'),
	},
	{
		name: 'absolute-path',
		tier: 'desktop',
		description: 'Full filesystem path, host OS style (desktop only)',
		resolve: (ctx) => ctx.absolutePath ?? '',
	},
	{
		name: 'file-url',
		tier: 'desktop',
		description: 'file:// URL, URL-encoded (desktop only)',
		resolve: (ctx) => (ctx.absolutePath ? buildFileUrl(ctx.absolutePath) : ''),
	},
	{
		name: 'obsidian-url',
		tier: 'universal',
		description: 'obsidian://open deep link, URL-encoded',
		resolve: (ctx) => buildObsidianUrl(ctx.vaultName, ctx.filePath),
	},
	{
		name: 'vault-name',
		tier: 'universal',
		description: 'Vault name, raw / unencoded',
		resolve: (ctx) => ctx.vaultName,
	},
	{
		name: 'vault-name-encoded',
		tier: 'universal',
		description: 'Vault name, URL-encoded',
		resolve: (ctx) => encodeURIComponent(ctx.vaultName),
	},
	{
		name: 'markdown-link',
		tier: 'universal',
		description: 'Markdown link in the format chosen in settings',
		resolve: (ctx) => buildMarkdownLink(ctx.fileName, ctx.filePath, ctx.markdownLinkFormat),
	},
	{
		name: 'wikilink',
		tier: 'universal',
		description: 'Wiki-style link, always',
		resolve: (ctx) => `[[${extractFilename(ctx.fileName, false)}]]`,
	},
	{
		name: 'obsidian-url-section',
		tier: 'universal',
		description: 'Obsidian URL to the cursor heading, or the file when there is none',
		resolve: (ctx) => {
			const base = buildObsidianUrl(ctx.vaultName, ctx.filePath);
			return ctx.currentHeading
				? `${base}&heading=${encodeURIComponent(ctx.currentHeading)}`
				: base;
		},
	},
	{
		name: 'wikilink-section',
		tier: 'universal',
		description: 'Wiki link to the cursor heading, or the file when there is none',
		resolve: (ctx) => {
			const base = extractFilename(ctx.fileName, false);
			return ctx.currentHeading ? `[[${base}#${ctx.currentHeading}]]` : `[[${base}]]`;
		},
	},
	{
		name: 'date',
		tier: 'universal',
		description: 'Current date, YYYY-MM-DD',
		resolve: (ctx) => formatDate(ctx.now),
	},
	{
		name: 'time',
		tier: 'universal',
		description: 'Current time, HH:mm',
		resolve: (ctx) => formatTime(ctx.now),
	},
	{
		name: 'line-number',
		tier: 'editor',
		description: 'Active editor cursor line, 1-based (editor only)',
		resolve: (ctx) => (ctx.lineNumber !== null ? String(ctx.lineNumber) : ''),
	},
	{
		name: 'heading',
		tier: 'editor',
		description: 'Heading the cursor sits under (editor only)',
		resolve: (ctx) => ctx.currentHeading ?? '',
	},
	{
		name: 'nl',
		tier: 'universal',
		description: 'A literal newline',
		resolve: () => '\n',
	},
];

const TOKEN_MAP: Map<string, TokenDef> = new Map(TOKENS.map((t) => [t.name, t]));

// Matches either an escape sequence (\< \> \\) or a <token-name> span.
// A token name is lowercase letters, digits, and dashes.
const TEMPLATE_PATTERN = /\\([<>\\])|<([a-z0-9-]+)>/g;

/**
 * Substitutes tokens in a template. Never throws. Unknown tokens are left
 * verbatim. Token output is never re-scanned, so a filename that literally
 * contains "<obsidian-url>" cannot trigger further substitution.
 */
export function applyTemplate(template: string, ctx: TokenContext): ApplyResult {
	const result: ApplyResult = {
		text: '',
		usedDesktopTokenOnMobile: false,
		usedEditorTokenWithoutEditor: false,
		unknownTokens: [],
	};

	let out = '';
	let lastIndex = 0;
	TEMPLATE_PATTERN.lastIndex = 0;
	let match: RegExpExecArray | null;

	while ((match = TEMPLATE_PATTERN.exec(template)) !== null) {
		out += template.slice(lastIndex, match.index);
		lastIndex = TEMPLATE_PATTERN.lastIndex;

		const escapeChar = match[1];
		if (escapeChar) {
			// Escape sequence: emit the literal character.
			out += escapeChar;
			continue;
		}

		const name = match[2];
		const def = TOKEN_MAP.get(name);
		if (!def) {
			// Unknown token: leave verbatim so typos are visible.
			out += match[0];
			if (!result.unknownTokens.includes(name)) {
				result.unknownTokens.push(name);
			}
			continue;
		}

		if (def.tier === 'desktop' && ctx.absolutePath === null) {
			result.usedDesktopTokenOnMobile = true;
			continue; // resolves to empty string
		}
		if (def.tier === 'editor' && ctx.lineNumber === null) {
			result.usedEditorTokenWithoutEditor = true;
			continue; // resolves to empty string
		}

		out += def.resolve(ctx);
	}

	out += template.slice(lastIndex);
	result.text = out;
	return result;
}

/**
 * Static template check for the settings UI. Reports unknown tokens, an empty
 * template, and tokens that will not resolve everywhere (desktop/editor only).
 */
export function validateTemplate(template: string): ValidationIssue[] {
	const issues: ValidationIssue[] = [];

	if (template.trim() === '') {
		issues.push({ kind: 'empty', detail: 'Template is empty.' });
	}

	const seen = new Set<string>();
	const pattern = /\\[<>\\]|<([a-z0-9-]+)>/g;
	let match: RegExpExecArray | null;

	while ((match = pattern.exec(template)) !== null) {
		const name = match[1];
		if (!name || seen.has(name)) {
			continue; // escape sequence, or a token already reported
		}
		seen.add(name);

		const def = TOKEN_MAP.get(name);
		if (!def) {
			issues.push({ kind: 'unknown-token', detail: `<${name}> is not a recognized token.` });
		} else if (def.tier === 'desktop') {
			issues.push({ kind: 'desktop-only-token', detail: `<${name}> is blank on mobile.` });
		} else if (def.tier === 'editor') {
			issues.push({
				kind: 'editor-only-token',
				detail: `<${name}> needs the file open in the editor.`,
			});
		}
	}

	return issues;
}

/** The full token list, for the settings token hint display. */
export function listTokens(): readonly TokenDef[] {
	return TOKENS;
}

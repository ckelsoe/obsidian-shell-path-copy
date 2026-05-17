import { applyTemplate, validateTemplate, listTokens, TokenContext } from '../token-engine';

// Builds a token context from the fixed sample scenario in token-usage.md,
// overridable per test. Base scenario: vault "assorted", file Notes/My file.md,
// Unix desktop host, the copied file open in the editor at line 42.
function makeContext(overrides: Partial<TokenContext> = {}): TokenContext {
	return {
		fileName: 'My file.md',
		filePath: 'Notes/My file.md',
		isFolder: false,
		vaultName: 'assorted',
		isWindows: false,
		absolutePath: '/home/name/assorted/Notes/My file.md',
		lineNumber: 42,
		currentHeading: null,
		blockId: null,
		markdownLinkFormat: 'wiki-style',
		now: new Date(2026, 4, 17, 14, 30),
		...overrides,
	};
}

// ─── individual tokens ───────────────────────────────────────────────────────

describe('applyTemplate - individual tokens', () => {
	const ctx = makeContext();

	it('<filename> drops the extension', () => {
		expect(applyTemplate('<filename>', ctx).text).toBe('My file');
	});

	it('<filename-ext> keeps the extension', () => {
		expect(applyTemplate('<filename-ext>', ctx).text).toBe('My file.md');
	});

	it('<extension> is the extension without the dot', () => {
		expect(applyTemplate('<extension>', ctx).text).toBe('md');
	});

	it('<relative-path> uses unix slashes on a unix host', () => {
		expect(applyTemplate('<relative-path>', ctx).text).toBe('./Notes/My file.md');
	});

	it('<relative-path> uses windows slashes on a windows host', () => {
		const win = makeContext({ isWindows: true });
		expect(applyTemplate('<relative-path>', win).text).toBe('.\\Notes\\My file.md');
	});

	it('<relative-path-unix> is always unix style', () => {
		expect(applyTemplate('<relative-path-unix>', ctx).text).toBe('./Notes/My file.md');
	});

	it('<relative-path-windows> is always windows style', () => {
		expect(applyTemplate('<relative-path-windows>', ctx).text).toBe('.\\Notes\\My file.md');
	});

	it('<absolute-path> on a unix host', () => {
		expect(applyTemplate('<absolute-path>', ctx).text).toBe('/home/name/assorted/Notes/My file.md');
	});

	it('<absolute-path> on a windows host', () => {
		const win = makeContext({ isWindows: true, absolutePath: 'C:\\Users\\name\\assorted\\Notes\\My file.md' });
		expect(applyTemplate('<absolute-path>', win).text).toBe('C:\\Users\\name\\assorted\\Notes\\My file.md');
	});

	it('<file-url> encodes spaces on a unix host', () => {
		expect(applyTemplate('<file-url>', ctx).text).toBe('file:///home/name/assorted/Notes/My%20file.md');
	});

	it('<file-url> keeps the drive letter and encodes spaces on a windows host', () => {
		const win = makeContext({ isWindows: true, absolutePath: 'C:\\Users\\name\\assorted\\Notes\\My file.md' });
		expect(applyTemplate('<file-url>', win).text).toBe('file:///C:/Users/name/assorted/Notes/My%20file.md');
	});

	it('<obsidian-url> strips .md and encodes the path', () => {
		expect(applyTemplate('<obsidian-url>', ctx).text).toBe('obsidian://open?vault=assorted&file=Notes%2FMy%20file');
	});

	it('<vault-name> is raw', () => {
		expect(applyTemplate('<vault-name>', ctx).text).toBe('assorted');
	});

	it('<vault-name-encoded> URL-encodes spaces', () => {
		const spaced = makeContext({ vaultName: 'My Vault' });
		expect(applyTemplate('<vault-name>', spaced).text).toBe('My Vault');
		expect(applyTemplate('<vault-name-encoded>', spaced).text).toBe('My%20Vault');
	});

	it('<markdown-link> follows the configured format', () => {
		expect(applyTemplate('<markdown-link>', ctx).text).toBe('[[My file]]');
		const standard = makeContext({ markdownLinkFormat: 'standard-markdown' });
		expect(applyTemplate('<markdown-link>', standard).text).toBe('[My file.md](./Notes/My file.md)');
	});

	it('<wikilink> is always wiki-style', () => {
		expect(applyTemplate('<wikilink>', ctx).text).toBe('[[My file]]');
	});

	it('<date> formats as YYYY-MM-DD', () => {
		expect(applyTemplate('<date>', ctx).text).toBe('2026-05-17');
	});

	it('<time> formats as HH:mm', () => {
		expect(applyTemplate('<time>', ctx).text).toBe('14:30');
	});

	it('<line-number> is the 1-based cursor line', () => {
		expect(applyTemplate('<line-number>', ctx).text).toBe('42');
	});

	it('<nl> is a literal newline', () => {
		expect(applyTemplate('a<nl>b', ctx).text).toBe('a\nb');
	});
});

// ─── composition ─────────────────────────────────────────────────────────────

describe('applyTemplate - composition', () => {
	const ctx = makeContext();

	it('renders the issue 13 example', () => {
		expect(applyTemplate('<filename> -> <obsidian-url>', ctx).text)
			.toBe('My file -> obsidian://open?vault=assorted&file=Notes%2FMy%20file');
	});

	it('renders an LLM-CLI line reference', () => {
		expect(applyTemplate('<filename-ext>#L<line-number>', ctx).text).toBe('My file.md#L42');
	});

	it('passes literal text through unchanged', () => {
		expect(applyTemplate('hello world', ctx).text).toBe('hello world');
	});

	it('substitutes a repeated token every time', () => {
		expect(applyTemplate('<filename> <filename>', ctx).text).toBe('My file My file');
	});

	it('does not re-scan token output (no recursion)', () => {
		const tricky = makeContext({ fileName: '<obsidian-url>.md' });
		expect(applyTemplate('<filename>', tricky).text).toBe('<obsidian-url>');
	});
});

// ─── escaping ─────────────────────────────────────────────────────────────────

describe('applyTemplate - escaping', () => {
	const ctx = makeContext();

	it('escapes angle brackets to a literal token', () => {
		expect(applyTemplate('\\<filename\\>', ctx).text).toBe('<filename>');
	});

	it('escapes a backslash', () => {
		expect(applyTemplate('a\\\\b', ctx).text).toBe('a\\b');
	});

	it('mixes a real token with an escaped one', () => {
		expect(applyTemplate('<filename> \\<tag\\>', ctx).text).toBe('My file <tag>');
	});
});

// ─── unknown tokens ───────────────────────────────────────────────────────────

describe('applyTemplate - unknown tokens', () => {
	const ctx = makeContext();

	it('leaves an unknown token verbatim and reports it', () => {
		const result = applyTemplate('<bogus>', ctx);
		expect(result.text).toBe('<bogus>');
		expect(result.unknownTokens).toEqual(['bogus']);
	});

	it('reports each unknown token once', () => {
		const result = applyTemplate('<bogus> <bogus> <filename>', ctx);
		expect(result.text).toBe('<bogus> <bogus> My file');
		expect(result.unknownTokens).toEqual(['bogus']);
	});
});

// ─── empty template ───────────────────────────────────────────────────────────

describe('applyTemplate - empty template', () => {
	it('returns an empty string with no flags set', () => {
		const result = applyTemplate('', makeContext());
		expect(result.text).toBe('');
		expect(result.usedDesktopTokenOnMobile).toBe(false);
		expect(result.usedEditorTokenWithoutEditor).toBe(false);
	});
});

// ─── fallback behavior ────────────────────────────────────────────────────────

describe('applyTemplate - desktop tokens on mobile', () => {
	const mobile = makeContext({ absolutePath: null });

	it('blanks <absolute-path> and flags it', () => {
		const result = applyTemplate('<absolute-path>', mobile);
		expect(result.text).toBe('');
		expect(result.usedDesktopTokenOnMobile).toBe(true);
	});

	it('blanks <file-url> and flags it', () => {
		const result = applyTemplate('x<file-url>y', mobile);
		expect(result.text).toBe('xy');
		expect(result.usedDesktopTokenOnMobile).toBe(true);
	});

	it('still resolves universal tokens around a blanked desktop token', () => {
		const result = applyTemplate('<filename>:<absolute-path>', mobile);
		expect(result.text).toBe('My file:');
		expect(result.usedDesktopTokenOnMobile).toBe(true);
	});
});

describe('applyTemplate - editor token without an editor', () => {
	it('blanks <line-number> and flags it', () => {
		const noEditor = makeContext({ lineNumber: null });
		const result = applyTemplate('<filename-ext>#L<line-number>', noEditor);
		expect(result.text).toBe('My file.md#L');
		expect(result.usedEditorTokenWithoutEditor).toBe(true);
	});
});

// ─── folders ──────────────────────────────────────────────────────────────────

describe('applyTemplate - folder context', () => {
	const folder = makeContext({ fileName: 'My folder', filePath: 'Projects/My folder', isFolder: true });

	it('<filename> equals <filename-ext> for a folder', () => {
		expect(applyTemplate('<filename>', folder).text).toBe('My folder');
		expect(applyTemplate('<filename-ext>', folder).text).toBe('My folder');
	});

	it('<extension> is empty for a folder', () => {
		expect(applyTemplate('<extension>', folder).text).toBe('');
	});
});

// ─── encoding edges ───────────────────────────────────────────────────────────

describe('applyTemplate - encoding edges', () => {
	const special = makeContext({
		fileName: 'a [b] #c &d.md',
		filePath: 'a [b] #c &d.md',
	});

	it('raw tokens keep special characters literal', () => {
		expect(applyTemplate('<filename>', special).text).toBe('a [b] #c &d');
	});

	it('<obsidian-url> URL-encodes special characters', () => {
		expect(applyTemplate('<obsidian-url>', special).text)
			.toBe('obsidian://open?vault=assorted&file=a%20%5Bb%5D%20%23c%20%26d');
	});
});

// ─── heading tokens ───────────────────────────────────────────────────────────

describe('applyTemplate - heading tokens', () => {
	const withHeading = makeContext({ currentHeading: 'My heading' });
	const noHeading = makeContext({ currentHeading: null });

	it('<heading> resolves to the cursor heading', () => {
		expect(applyTemplate('<heading>', withHeading).text).toBe('My heading');
	});

	it('<heading> is blank when the cursor is under no heading', () => {
		expect(applyTemplate('<heading>', noHeading).text).toBe('');
	});

	it('<obsidian-url-heading> anchors to the heading when there is one', () => {
		// The heading goes into the file value as "#heading" (encoded %23);
		// obsidian://open has no separate heading parameter.
		expect(applyTemplate('<obsidian-url-heading>', withHeading).text)
			.toBe('obsidian://open?vault=assorted&file=Notes%2FMy%20file%23My%20heading');
	});

	it('<obsidian-url-heading> falls back to the file URL with no heading', () => {
		expect(applyTemplate('<obsidian-url-heading>', noHeading).text)
			.toBe('obsidian://open?vault=assorted&file=Notes%2FMy%20file');
	});

	it('<wikilink-heading> anchors to the heading when there is one', () => {
		expect(applyTemplate('<wikilink-heading>', withHeading).text).toBe('[[My file#My heading]]');
	});

	it('<wikilink-heading> falls back to the file link with no heading', () => {
		expect(applyTemplate('<wikilink-heading>', noHeading).text).toBe('[[My file]]');
	});

	it('the section tokens always resolve (universal tier)', () => {
		const result = applyTemplate('<obsidian-url-heading> <wikilink-heading>', noHeading);
		expect(result.usedEditorTokenWithoutEditor).toBe(false);
	});
});

// ─── block tokens ─────────────────────────────────────────────────────────────

describe('applyTemplate - block tokens', () => {
	const withBlock = makeContext({ blockId: 'a1b2c3' });
	const noBlock = makeContext({ blockId: null });

	it('<block-id> resolves to the block id', () => {
		expect(applyTemplate('<block-id>', withBlock).text).toBe('a1b2c3');
	});

	it('<block-id> is blank when the cursor is on no block', () => {
		expect(applyTemplate('<block-id>', noBlock).text).toBe('');
	});

	it('<obsidian-url-block> anchors to the block with #^id (encoded %23%5E)', () => {
		expect(applyTemplate('<obsidian-url-block>', withBlock).text)
			.toBe('obsidian://open?vault=assorted&file=Notes%2FMy%20file%23%5Ea1b2c3');
	});

	it('<obsidian-url-block> falls back to the file URL with no block', () => {
		expect(applyTemplate('<obsidian-url-block>', noBlock).text)
			.toBe('obsidian://open?vault=assorted&file=Notes%2FMy%20file');
	});

	it('<wikilink-block> anchors to the block with #^id', () => {
		expect(applyTemplate('<wikilink-block>', withBlock).text).toBe('[[My file#^a1b2c3]]');
	});

	it('<wikilink-block> falls back to the file link with no block', () => {
		expect(applyTemplate('<wikilink-block>', noBlock).text).toBe('[[My file]]');
	});
});

// ─── validateTemplate ─────────────────────────────────────────────────────────

describe('validateTemplate', () => {
	it('flags an empty template', () => {
		const issues = validateTemplate('   ');
		expect(issues.some((i) => i.kind === 'empty')).toBe(true);
	});

	it('flags an unknown token', () => {
		const issues = validateTemplate('<bogus>');
		expect(issues.some((i) => i.kind === 'unknown-token')).toBe(true);
	});

	it('flags a desktop-only token', () => {
		const issues = validateTemplate('<absolute-path>');
		expect(issues.some((i) => i.kind === 'desktop-only-token')).toBe(true);
	});

	it('flags an editor-only token', () => {
		const issues = validateTemplate('<line-number>');
		expect(issues.some((i) => i.kind === 'editor-only-token')).toBe(true);
	});

	it('passes a valid universal-only template', () => {
		expect(validateTemplate('<filename> -> <obsidian-url>')).toEqual([]);
	});
});

// ─── listTokens ───────────────────────────────────────────────────────────────

describe('listTokens', () => {
	it('returns the full token set with tiers', () => {
		const tokens = listTokens();
		expect(tokens.length).toBe(23);
		const absolutePath = tokens.find((t) => t.name === 'absolute-path');
		expect(absolutePath?.tier).toBe('desktop');
		const lineNumber = tokens.find((t) => t.name === 'line-number');
		expect(lineNumber?.tier).toBe('editor');
		const filename = tokens.find((t) => t.name === 'filename');
		expect(filename?.tier).toBe('universal');
	});
});

import {
	wrapPath,
	formatRelativePath,
	buildFileUrl,
	buildObsidianUrl,
	buildMarkdownLink,
} from '../path-utils';

// ─── wrapPath ────────────────────────────────────────────────────────────────

describe('wrapPath', () => {
	it('returns path unchanged for none', () => {
		expect(wrapPath('/vault/file.md', 'none')).toBe('/vault/file.md');
	});

	it('wraps in double quotes', () => {
		expect(wrapPath('/vault/file.md', 'double-quotes')).toBe('"/vault/file.md"');
	});

	it('wraps in single quotes', () => {
		expect(wrapPath('/vault/file.md', 'single-quotes')).toBe("'/vault/file.md'");
	});

	it('wraps in backticks', () => {
		expect(wrapPath('/vault/file.md', 'backticks')).toBe('`/vault/file.md`');
	});

	it('handles paths with spaces', () => {
		expect(wrapPath('/my vault/my file.md', 'double-quotes')).toBe('"/my vault/my file.md"');
	});

	it('handles empty string', () => {
		expect(wrapPath('', 'double-quotes')).toBe('""');
	});
});

// ─── formatRelativePath ───────────────────────────────────────────────────────

describe('formatRelativePath', () => {
	describe('unix format', () => {
		it('adds ./ prefix to a plain path', () => {
			expect(formatRelativePath('folder/file.md', 'unix')).toBe('./folder/file.md');
		});

		it('does not double-add ./ prefix', () => {
			expect(formatRelativePath('./folder/file.md', 'unix')).toBe('./folder/file.md');
		});

		it('handles nested paths', () => {
			expect(formatRelativePath('a/b/c/file.md', 'unix')).toBe('./a/b/c/file.md');
		});

		it('handles empty path as vault root', () => {
			expect(formatRelativePath('', 'unix')).toBe('./');
		});

		it('handles a top-level file', () => {
			expect(formatRelativePath('file.md', 'unix')).toBe('./file.md');
		});
	});

	describe('windows format', () => {
		it('converts forward slashes to backslashes', () => {
			expect(formatRelativePath('folder/file.md', 'windows')).toBe('.\\folder\\file.md');
		});

		it('adds .\\ prefix', () => {
			expect(formatRelativePath('file.md', 'windows')).toBe('.\\file.md');
		});

		it('does not double-add .\\ prefix', () => {
			expect(formatRelativePath('.\\file.md', 'windows')).toBe('.\\file.md');
		});

		it('handles nested paths', () => {
			expect(formatRelativePath('a/b/c/file.md', 'windows')).toBe('.\\a\\b\\c\\file.md');
		});

		it('handles empty path as vault root', () => {
			expect(formatRelativePath('', 'windows')).toBe('.\\');
		});
	});
});

// ─── buildFileUrl ─────────────────────────────────────────────────────────────

describe('buildFileUrl', () => {
	describe('unix paths', () => {
		it('builds a file URL for a unix absolute path', () => {
			expect(buildFileUrl('/home/user/vault/file.md')).toBe('file:///home/user/vault/file.md');
		});

		it('encodes spaces in path segments', () => {
			expect(buildFileUrl('/home/user/my vault/my file.md')).toBe(
				'file:///home/user/my%20vault/my%20file.md'
			);
		});

		it('encodes special characters in segments', () => {
			expect(buildFileUrl('/vault/file [draft].md')).toBe(
				'file:///vault/file%20%5Bdraft%5D.md'
			);
		});

		it('does not encode slashes between segments', () => {
			const url = buildFileUrl('/home/user/vault/folder/file.md');
			expect(url).toBe('file:///home/user/vault/folder/file.md');
			expect(url.split('file://')[1]).not.toContain('%2F');
		});
	});

	describe('windows paths', () => {
		it('builds a file URL for a windows absolute path', () => {
			expect(buildFileUrl('C:\\Users\\name\\vault\\file.md')).toBe(
				'file:///C:/Users/name/vault/file.md'
			);
		});

		it('handles lowercase drive letter', () => {
			expect(buildFileUrl('c:\\vault\\file.md')).toBe('file:///c:/vault/file.md');
		});

		it('encodes spaces in windows path segments', () => {
			expect(buildFileUrl('C:\\Users\\My Vault\\file.md')).toBe(
				'file:///C:/Users/My%20Vault/file.md'
			);
		});
	});
});

// ─── buildObsidianUrl ─────────────────────────────────────────────────────────

describe('buildObsidianUrl', () => {
	it('builds a basic obsidian URL', () => {
		expect(buildObsidianUrl('MyVault', 'folder/file.md')).toBe(
			'obsidian://open?vault=MyVault&file=folder%2Ffile'
		);
	});

	it('strips the .md extension', () => {
		const url = buildObsidianUrl('Vault', 'notes/meeting.md');
		expect(url).toContain('file=notes%2Fmeeting');
		expect(url).not.toContain('.md');
	});

	it('does not strip extensions other than .md', () => {
		const url = buildObsidianUrl('Vault', 'attachments/image.png');
		expect(url).toContain('image.png');
	});

	it('encodes spaces in vault name', () => {
		expect(buildObsidianUrl('My Vault', 'file.md')).toContain('vault=My%20Vault');
	});

	it('encodes spaces in file path', () => {
		expect(buildObsidianUrl('Vault', 'my notes/file.md')).toContain(
			'file=my%20notes%2Ffile'
		);
	});

	it('handles a top-level file', () => {
		expect(buildObsidianUrl('Vault', 'file.md')).toBe(
			'obsidian://open?vault=Vault&file=file'
		);
	});
});

// ─── buildMarkdownLink ────────────────────────────────────────────────────────

describe('buildMarkdownLink', () => {
	describe('wiki-style', () => {
		it('builds a wiki-style link', () => {
			expect(buildMarkdownLink('file.md', 'folder/file.md', 'wiki-style')).toBe('[[file]]');
		});

		it('strips the file extension', () => {
			expect(buildMarkdownLink('meeting notes.md', 'folder/meeting notes.md', 'wiki-style')).toBe(
				'[[meeting notes]]'
			);
		});

		it('handles a file with no extension', () => {
			expect(buildMarkdownLink('README', 'README', 'wiki-style')).toBe('[[README]]');
		});
	});

	describe('standard markdown', () => {
		it('builds a standard markdown link', () => {
			expect(buildMarkdownLink('file.md', 'folder/file.md', 'standard-markdown')).toBe(
				'[file.md](./folder/file.md)'
			);
		});

		it('adds ./ prefix to path', () => {
			const link = buildMarkdownLink('file.md', 'file.md', 'standard-markdown');
			expect(link).toBe('[file.md](./file.md)');
		});

		it('does not double-add ./ prefix', () => {
			const link = buildMarkdownLink('file.md', './file.md', 'standard-markdown');
			expect(link).toBe('[file.md](./file.md)');
		});

		it('handles empty file path as vault root', () => {
			const link = buildMarkdownLink('', '', 'standard-markdown');
			expect(link).toBe('[](./)')
		});

		it('uses the full fileName (with extension) as link text', () => {
			const link = buildMarkdownLink('report.md', 'reports/report.md', 'standard-markdown');
			expect(link).toMatch(/^\[report\.md\]/);
		});
	});
});

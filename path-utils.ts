export type PathWrapping = 'none' | 'double-quotes' | 'single-quotes' | 'backticks';
export type PathFormat = 'unix' | 'windows';
export type MarkdownLinkFormat = 'wiki-style' | 'standard-markdown';

export function wrapPath(filePath: string, wrapping: PathWrapping): string {
	switch (wrapping) {
		case 'double-quotes': return `"${filePath}"`;
		case 'single-quotes': return `'${filePath}'`;
		case 'backticks':     return `\`${filePath}\``;
		case 'none':
		default:              return filePath;
	}
}

export function formatRelativePath(filePath: string, format: PathFormat): string {
	if (!filePath) {
		return format === 'windows' ? '.\\' : './';
	}
	if (format === 'windows') {
		const winPath = filePath.replace(/\//g, '\\');
		return winPath.startsWith('.\\') ? winPath : '.\\' + winPath;
	}
	return filePath.startsWith('./') ? filePath : './' + filePath;
}

export function buildFileUrl(absolutePath: string): string {
	if (/^[a-zA-Z]:/.test(absolutePath)) {
		// Windows absolute path (e.g. C:\Users\name\file.md)
		// The drive letter contains a colon that must NOT be encoded.
		// Split on the first '/' after converting backslashes so the drive
		// letter ("C:") is kept intact and only the remaining segments are encoded.
		const forwardSlashed = absolutePath.replace(/\\/g, '/');
		const [drive, ...segments] = forwardSlashed.split('/');
		const encodedSegments = segments.map(seg => seg === '' ? '' : encodeURIComponent(seg));
		return `file:///${drive}/${encodedSegments.join('/')}`;
	} else {
		// Unix/Mac absolute path (e.g. /home/user/file.md)
		const segments = absolutePath.split('/');
		const encodedSegments = segments.map(seg => seg === '' ? '' : encodeURIComponent(seg));
		return `file://${encodedSegments.join('/')}`;
	}
}

export function buildObsidianUrl(vaultName: string, filePath: string): string {
	const normalizedPath = filePath.endsWith('.md') ? filePath.slice(0, -3) : filePath;
	return `obsidian://open?vault=${encodeURIComponent(vaultName)}&file=${encodeURIComponent(normalizedPath)}`;
}

export function buildMarkdownLink(fileName: string, filePath: string, format: MarkdownLinkFormat): string {
	const fileNameWithoutExt = fileName.includes('.')
		? fileName.substring(0, fileName.lastIndexOf('.'))
		: fileName;

	if (format === 'wiki-style') {
		return `[[${fileNameWithoutExt}]]`;
	}

	const relativePath = filePath
		? (filePath.startsWith('./') ? filePath : './' + filePath)
		: './';
	return `[${fileName}](${relativePath})`;
}

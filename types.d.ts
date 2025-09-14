import 'obsidian';

declare module 'obsidian' {
    interface PluginManifest {
        version: string;
    }
}

// Extend FileSystemAdapter to include the getFullRealPath method
// This method is available in desktop environments but not declared in the base types
export interface ExtendedFileSystemAdapter {
    getFullRealPath(path: string): string;
}
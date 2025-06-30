import 'obsidian';

declare module 'obsidian' {
    interface FileSystemAdapter {
        getFullRealPath(path: string): string;
    }
    
    interface PluginManifest {
        version: string;
    }
}
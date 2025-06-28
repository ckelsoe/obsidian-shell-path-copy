# Obsidian Path Copy Plugin

A simple Obsidian plugin that adds right-click context menu options to copy file and folder paths relative to your vault root. Perfect for quickly sharing file locations with AI assistants like Claude Code or other tools that need precise file paths.

## Features

- **Right-click menu integration**: Adds "Copy Path" options to files and folders in the file explorer
- **Multiple path formats**:
  - Linux path format (forward slashes): `/doc/file.md`
  - Windows path format (backslashes): `\doc\file.md`
- **Smart path wrapping**: Automatically wraps paths in backticks (configurable) to handle spaces properly
- **Vault-relative paths**: All paths are relative to your vault root for portability
- **Success notifications**: Visual feedback when paths are copied
- **Customizable settings**: Configure path wrapping, menu display options, and more

## Installation

### From Obsidian Community Plugins (Coming Soon)
1. Open Settings → Community Plugins
2. Search for "Path Copy"
3. Install and enable the plugin

### Manual Installation
1. Download `main.js`, `manifest.json`, and `styles.css` from the latest release
2. Create a folder named `obsidian-path-copy` in your vault's `.obsidian/plugins/` directory
3. Copy the downloaded files into this folder
4. Reload Obsidian
5. Enable "Path Copy" in Settings → Community Plugins

## Usage

1. Right-click any file or folder in the Obsidian file explorer
2. Select "Copy Path" from the context menu
3. Choose your desired format:
   - **Copy Linux Path**: For Unix/Linux/macOS systems (e.g., `/folder/file.md`)
   - **Copy Windows Path**: For Windows systems (e.g., `\folder\file.md`)
4. The path is copied to your clipboard, wrapped in backticks by default
5. Paste it anywhere you need!

### Example Use Cases
- Sharing file locations with AI coding assistants
- Documenting file structures in notes
- Creating file references in technical documentation
- Quick file path sharing in team communications

## Settings

Access plugin settings via Settings → Plugin Options → Path Copy:

- **Path Wrapping**: Choose how paths are wrapped when copied
  - None: No wrapping
  - Double Quotes: `"path/to/file"`
  - Single Quotes: `'path/to/file'`
  - Backticks: `` `path/to/file` `` (default - recommended for paths with spaces)

- **Menu Display**: Control which path formats appear in the context menu
  - Show both OS formats (default)
  - Show only current OS format

- **Notifications**: Toggle success notifications on/off

## Development

### Prerequisites
- Node.js 16+ 
- npm or yarn

### Setup
```bash
# Clone the repository
git clone https://github.com/yourusername/obsidian-path-copy.git

# Navigate to the src directory
cd obsidian-path-copy/src

# Install dependencies
npm install

# Start development build with auto-reload
npm run dev
```

### Building
```bash
# Build for production
npm run build
```

### Code Quality
This plugin uses ESLint for code quality. Run linting with:
```bash
npm run lint
```

## Contributing

Contributions are welcome! Please:
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Built with the [Obsidian API](https://github.com/obsidianmd/obsidian-api)
- Inspired by the need for better file path handling when working with AI coding assistants
- Thanks to the Obsidian community for their support and feedback

## Support

If you find this plugin helpful, consider:
- ⭐ Starring the repository on GitHub
- 🐛 Reporting bugs or suggesting features via [GitHub Issues](https://github.com/yourusername/obsidian-path-copy/issues)
- 💬 Sharing feedback in the Obsidian Discord server
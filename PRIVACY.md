# Privacy Policy

_Last updated: 2026-05-15_

This policy explains what the **Shell Path Copy** Obsidian plugin ("the plugin") does and does not do with your data. It applies to the plugin as distributed through the Obsidian Community Plugins marketplace, GitHub releases, and BRAT.

## Summary

The plugin collects nothing, stores nothing outside your own vault, and sends nothing anywhere. It contains no network code.

## What the plugin does

Shell Path Copy reads the path of a file or folder you select inside Obsidian, formats it, and places the result on your operating system's clipboard. That is the entire data flow.

## Data collection

- **No personal data is collected.** The plugin does not collect names, email addresses, file contents, usage statistics, or any other information.
- **No telemetry or analytics.** There is no tracking, crash reporting, or phone-home behavior of any kind.
- **No automatic background activity.** The plugin acts only when you explicitly invoke a copy command from the context menu or command palette.

## Data storage

- The plugin's settings (your display and path-wrapping preferences) are stored by Obsidian in your vault's local `data.json` file, on your own device. They never leave your device.
- File and folder paths are written only to your system clipboard, by your explicit action. The plugin does not retain, log, or transmit them.

## Network use

The plugin contains **no network code**. It makes no HTTP requests, opens no sockets, and contacts no servers. Not the maintainer's, not Obsidian's, not any third party.

## Third parties

The plugin shares no data with any third party. It has no data to share and no means to transmit it.

## Disclaimer of liability

The plugin is provided free of charge, "AS IS", without warranty of any kind, as set out in the [MIT License](./LICENSE). To the maximum extent permitted by law, the maintainer is not liable for any loss, damage, or claim arising from use of the plugin. You are responsible for verifying that any copied path is correct and safe before using it in a shell or any other tool.

## Information you choose to share

If you open a GitHub issue, discussion, or pull request, anything you paste there (file paths, screenshots, vault structure, system details) becomes **public**. The maintainer does not request this information and is not responsible for content you choose to post. Review and redact anything sensitive before submitting. To report a security vulnerability privately instead, see [SECURITY.md](./SECURITY.md).

## Changes to this policy

This policy may be updated as the plugin evolves. Material changes will be noted in [CHANGELOG.md](./CHANGELOG.md). The "last updated" date above reflects the current version.

## Contact

Questions about this policy: open an issue at [github.com/ckelsoe/obsidian-shell-path-copy/issues](https://github.com/ckelsoe/obsidian-shell-path-copy/issues). Do not use a public issue for security vulnerabilities; see [SECURITY.md](./SECURITY.md) for the private reporting channel.

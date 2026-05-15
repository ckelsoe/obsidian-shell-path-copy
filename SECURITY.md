# Security Policy

## Supported Versions

The Shell Path Copy plugin follows a simple versioning scheme. Only the latest version receives security updates.

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

If you discover a security vulnerability in Shell Path Copy, please report it **privately** so it can be fixed before public disclosure:

1. **DO NOT** open a public GitHub issue for security vulnerabilities.
2. Open the repository's **Security** tab and click **Report a vulnerability**, or use this direct link: <https://github.com/ckelsoe/obsidian-shell-path-copy/security/advisories/new>
3. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

Reports submitted through GitHub private vulnerability reporting are visible only to you and the maintainer until an advisory is published.

### What to expect:

- Acknowledgment within 48 hours
- Assessment and response within 7 days
- Security patch released as soon as possible
- Credit given to reporter (unless you prefer to remain anonymous)

## Security Considerations

This plugin:

- Only reads file paths and copies them to the clipboard
- Does not execute shell commands
- Does not modify files
- Does not transmit data externally
- Has no network capabilities

The primary security consideration is ensuring paths with special characters are properly escaped when used in shell commands (which is the user's responsibility after copying).
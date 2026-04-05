# Title Tamer

![CI/CD](https://github.com/irvinm/Title-Tamer/workflows/CI/CD/badge.svg) ![Mozilla Add-on](https://img.shields.io/amo/users/Title-Tamer.svg?style=flat-square) ![](https://img.shields.io/amo/v/Title-Tamer.svg?style=flat-square)

<img src="https://github.com/user-attachments/assets/78f5973c-f9d5-4dff-8d72-113df255fe10" alt="Light Mode" width="800" height="600">
<img src="https://github.com/user-attachments/assets/4ba17621-4a1b-4849-9042-5b24499ae298" alt="Dark Mode" width="800" height="600">

## Features
- Monitor tab URLs and change their titles based on user-defined search patterns.
- **URL Decoding Support**: Automatically decodes percent-encoded characters (like `%20`, `%22`, etc.) within captured URL segments. This ensures that titles like `Search: My%20Query` are rendered as `Search: My Query` in your tab.
- **Advanced RegEx Support**: Full support for JavaScript Regular Expressions, including capture groups and anchors.
- **Special Character Support**: All patterns and titles are escaped to ensure characters like `<`, `>`, and `&` are rendered correctly in the options interface.
- **Import/Export**: Easily backup or share your pattern collections via JSON files.
- **Load & Discard**: Automatically manage tab lifecycles when updating rules.
- **Flexible Management**: Add, delete, update, and reorder patterns in priority order via a dedicated options page.

## Examples
- https://github.com/irvinm/Title-Tamer/wiki/Examples

## Limitations
- Will not work on browser built-in pages like `about:debugging`, `about:addons`, etc.
- Requires host permission for certain pages like reader view, view-source, and PDF viewer pages.
- Title Tamer updates the `document.title` to update the title, and that can only be done with a loaded tab.
- Discarded tabs' title cannot be updated until loaded.
- Redirecting sites (logins, etc.) might cause rules to be applied or not.

## Roadmap
- Support for Firefox Sync for pattern synchronization.
- Keyboard shortcuts for quick title management actions.
- Add badge option to show the number of active patterns.
- Option to reload tabs after deleting a rule to restore original titles.
- Support for Firefox and Tree Style Tab (TST) integration for "Rename this tab" context menu.
- Case-insensitivity option for non-regex patterns.

## Debug/Testing
1. Go to [https://regex101.com/](https://regex101.com/)
2. Enable "ECMAScript (JavaScript)" under "FLAVOR" in the left nav bar
3. Enter your pattern in the "REGULAR EXPRESSION" box
4. Enter your test URL in the "TEST STRING" box
5. Ensure your pattern matches the URL as expected

## Development

### Prerequisites
- Node.js (v24+ recommended)
- `web-ext` (installed globally or via `npm`)

### Commands
- `npm install` - Install dependencies
- `npm test` - Run unit tests (Mocha/Chai)
- `npm run lint` - Run extension linter
- `npm run start` - Run extension in development mode
- `npm run build` - Build the extension for release

## Inspiration
- Rename Tab Title - https://addons.mozilla.org/en-US/firefox/addon/rename-tab-title/
- Tab ReTitle - https://addons.mozilla.org/en-US/firefox/addon/tab-retitle/

## Changelog

### Version 0.9.4 (Mar 29, 2026)
- **URL Decoding**: Added support for decoding percent-encoded characters in URLs before matching (Issue #7).
- **Display Improvements**: Implemented HTML escaping to ensure special characters in patterns and titles are rendered correctly instead of being interpreted as HTML code.
- **Robust Title Sanitization**: Improved `document.title` handling using JSON serialization to prevent special character corruption.
- **Infrastructure**: Introduced Node.js toolchain, unit testing suite, and GitHub Actions CI/CD.
- **Organization**: Restructured the project to group source files in the `src/` directory.

<details>
<summary><b>Version 0.9.3 (Jun 15, 2025)</b></summary>

- Added dark mode support for options popup (https://github.com/irvinm/Title-Tamer/issues/6)
- Cleaned up popup UI a little
</details>

<details>
<summary><b>Version 0.9.2 (Mar 24, 2025)</b></summary>

- Fixed issue when dealing with dark mode and addon icon under certain conditions. (https://github.com/irvinm/Title-Tamer/issues/5)
</details>

<details>
<summary><b>Version 0.9.1 (Dec 15, 2024)</b></summary>

- Fixed issue when editing rules that some buttons showed thru the header of the table. (https://github.com/irvinm/Title-Tamer/issues/1)
</details>

<details>
<summary><b>Version 0.9.0 (Nov 26, 2024)</b></summary>

- Monitor tab URLs and changes the tabs title based on user-defined search patterns.
- Monitor for new tabs, changed URLs, and changed titles.
- Support regular expressions for advanced pattern matching including groups and exact matches.
- Support string searches for substring matches including basic domain matches.
- Option to load and discard tabs when rules are added or edited.
- Import and export patterns for easy sharing and backup.
- Support opening the options in a separate tab for a wider view of your patterns.
- Initial support to add, delete, update, reorder patterns in priority order.
</details>

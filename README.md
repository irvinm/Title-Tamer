# Title Tamer

![CI/CD](https://github.com/irvinm/Title-Tamer/workflows/CI/CD/badge.svg) ![Mozilla Add-on](https://img.shields.io/amo/users/Title-Tamer.svg?style=flat-square) ![](https://img.shields.io/amo/v/Title-Tamer.svg?style=flat-square)

![Light Mode](https://github.com/user-attachments/assets/78f5973c-f9d5-4dff-8d72-113df255fe10)
![Dark Mode](https://github.com/user-attachments/assets/4ba17621-4a1b-4849-9042-5b24499ae298)

## Features
- Monitor tab URLs and change their titles based on user-defined search patterns.
- Monitor for new tabs, changed URLs, and changed titles.
- Support for regular expressions for advanced pattern matching including groups and exact matches.
- Support for string searches for substring matches including basic domain matches.
- Option to load and discard tabs when rules are added or edited.
- Import and export patterns for easy sharing and backup.
- Support opening the options in a separate tab for a wider view of your patterns.
- Initial support to add, delete, update, reorder patterns in priority order.

## Examples
- https://github.com/irvinm/Title-Tamer/wiki/Examples

## Limitations
- Will not work on browser built-in pages like `about:debugging`, `about:addons`, etc.
- Requires host permission for certain pages like reader view, view-source, and PDF viewer pages.
- Title Tamer updates the `document.title` to update the title, and that can only be done with a loaded tab.
- Discarded tabs' title cannot be updated until loaded.
- Redirecting sites (logins, etc.) might cause rules to be applied or not.

## Roadmap
- Add dark mode to options & pages.
- Support for Firefox Sync.
- Keyboard shortcuts for quick actions.
- Add badge option to show the number of patterns being monitored.
- Option to reload tabs after deleting a rule to restore titles.
- Add support for FF and TST for UI options to "Rename this tab".
- Default rules are case sensitive, give user option to disable.
- Add total number of existing patterns somewhere on the options page.

## Debug/Testing
1. Go to [https://regex101.com/](https://regex101.com/)
2. Enable "ECMAScript (JavaScript)" under "FLAVOR" in the left nav bar
3. Enter your pattern in the "REGULAR EXPRESSION" box
4. Enter your test URL in the "TEST STRING" box
5. Ensure your pattern matches the URL as expected

## Inspiration
- Rename Tab Title - https://addons.mozilla.org/en-US/firefox/addon/rename-tab-title/
- Tab ReTitle - https://addons.mozilla.org/en-US/firefox/addon/tab-retitle/

## Changelog

### Version 0.9.3 (Jun 15, 2025)
- Added dark mode support for options popup (https://github.com/irvinm/Title-Tamer/issues/6)
- Cleaned up popup UI a little

### Version 0.9.2 (Mar 24, 2025)
- Fixed issue when dealing with dark mode and addon icon under certain conditions. (https://github.com/irvinm/Title-Tamer/issues/5)

### Version 0.9.1 (Dec 15, 2024)
- Fixed issue when editing rules that some buttons showed thru the header of the table. (https://github.com/irvinm/Title-Tamer/issues/1)

### Version 0.9.0 (Nov 26, 2024)
- Monitor tab URLs and changes the tabs title based on user-defined search patterns.
- Monitor for new tabs, changed URLs, and changed titles.
- Support regular expressions for advanced pattern matching including groups and exact matches.
- Support string searches for substring matches including basic domain matches.
- Option to load and discard tabs when rules are added or edited.
- Import and export patterns for easy sharing and backup.
- Support opening the options in a separate tab for a wider view of your patterns.
- Initial support to add, delete, update, reorder patterns in priority order.

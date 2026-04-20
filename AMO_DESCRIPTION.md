**AMO Store Listing**

**Brief Summary (Max 250 characters)**
Take full control of your browser tabs with Title Tamer. Rename tabs dynamically using simple text or powerful RegEx, organize rules into groups, and manage thousands of tabs effortlessly with a performance-safe sync engine.

**Full Description**

**Take full control of your browser tab titles.**

Title Tamer is a powerful extension designed to give you total command over your workspace. Whether you're managing research projects, work sessions, or personal browsing, Title Tamer helps you stay organized by dynamically renaming your tabs based on rules YOU define.

**Powerful Organization**
- **Rule Grouping**: Organize your patterns into logical groups with collapsible headers to keep your workspace tidy.
- **Bulk Toggles**: Enable or disable entire groups of rules with a single click—perfect for quickly switching between different workflows.
- **Visual Drag-and-Drop**: Effortlessly reorder rules and groups to prioritize exactly which patterns take precedence.

**Advanced Matching Logic**
- **Flexible Pattern Matching**: Use simple substring matches for quick fixes or JavaScript Regular Expressions (with capture group support) for advanced URL parsing.
- **Variable Injection**: Use captured URL segments ($1, $2, etc.) to inject dynamic data directly into your tab titles.
- **URL Decoding**: Automatically handles percent-encoded characters (like %20 or %F) so your titles look clean and readable.
- **Zero-Flicker Guardian**: Leverages a robust in-page MutationObserver to instantly re-assert your custom title if a website attempts to overwrite it.
- **Real-Time Monitoring**: Detects and applies rules the moment a URL changes or a new tab is opened.

**Performance & Reliability**
- **Throttled Sync Engine**: Robustly manages thousands of tabs using a rolling worker pool, ensuring your titles stay accurate without impacting browser performance.
- **Amnesia Recovery**: Correctly identifies and restores your custom titles even after browser restarts or extension reloads.
- **Intelligent Discard Management**: Optionally wake, re-title, and re-discard tabs automatically with configurable delays and anti-throbber fixes.

**User Experience**
- **Modern Theme-Aware UI**: A sleek, responsive interface designed to feel native in both Light and Dark modes.
- **Wider View**: Support for opening the configuration interface in a separate tab for a full-screen overview of your rules.
- **Import/Export**: Easily backup or share your entire pattern collection via JSON files.
- **Developer Tools**: Built-in diagnostic logging to help power users troubleshoot complex title collisions and matching behavior.

**Limitations**
- Does not work on browser-internal pages (e.g., `about:addons`, `about:config`).
- Does not work on Firefox-protected domains (e.g., `addons.mozilla.org`).
- Requires host permissions for special pages like Reader View, PDF Viewers, or `view-source`.
- State-based sync engine requires a brief automated wake/reload cycle to retitle discarded tabs.

**Testing Your Patterns**
1. Visit [regex101.com](https://regex101.com).
2. Select "ECMAScript (JavaScript)" flavor.
3. Enter your pattern and a test URL.
4. Verify your matches before saving in Title Tamer!

*Inspired by the great work of "Rename Tab Title" and "Tab ReTitle", built for power users who need more control.*

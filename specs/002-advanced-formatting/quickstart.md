# Quickstart: Testing Advanced Formatting

This document details how to run the automated tests and manually verify the advanced string transformations.

## Automated Verification

All formatting changes are tested via Mocha unit tests in `tests/unit/pattern-matching.test.js`.

### Run All Unit Tests
```bash
npm install
npm test
```

### Run Only Pattern Matching Tests
```bash
npx mocha tests/unit/pattern-matching.test.js
```

---

## Manual Verification

To test the formatting engine inside a running browser instance:

1. **Start the Extension**:
   ```bash
   npm run start
   ```
   This launches a clean browser profile with Title Tamer pre-installed.

2. **Open Options Page**:
   Click the extension icon in the toolbar, or open the Extension Settings page and click **Options**.

3. **Configure Group & Rules**:
   Add a new group and add a rule under it with the following configuration:
   - **Search Pattern (Regex)**: `github\.com/[^/]+/([^/]+)`
   - **Replacement Title**: `$1.replace("-", " ").title() — Repo`

4. **Test the Rule**:
   Open a new tab and go to:
   `https://github.com/irvinm/title-tamer`

5. **Verify Tab Title**:
   Observe the browser tab. The title should instantly update to:
   `Title Tamer — Repo`

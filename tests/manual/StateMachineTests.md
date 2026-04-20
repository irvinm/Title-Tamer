# Title Tamer - State Machine Architecture Test Plan

## Pre-requisites
1. Have the `test_patterns.json` imported so you have reliable test rules.
2. Have `test_URLs.txt` handy to open the test URLs.
3. Open a few tabs from `test_URLs.txt` (e.g., YouTube, GitHub, Twitter).

---

## 1. Core Lifecycle & Synchronization
**Goal:** Verify titles update seamlessly in real-time without requiring a page refresh.
*   **Step 1.1:** Navigate to `https://github.com/google/guava` in a new tab.
    *   *Expected:* Tab title immediately changes to **"Repo: guava"**.
*   **Step 1.2:** Open the Title Tamer Options. Uncheck (disable) the "Development" group toggle.
    *   *Expected:* The GitHub tab instantly reverts to its native title (e.g., "google/guava: Google Core Libraries for Java...").
*   **Step 1.3:** Re-enable the "Development" group toggle.
    *   *Expected:* The GitHub tab instantly re-applies **"Repo: guava"**.
*   **Step 1.4:** Click the "Delete" button on the specific GitHub rule in the Options page. Proceed through the new thematic confirmation dialog.
    *   *Expected:* The rule is removed, and the GitHub tab instantly reverts to its native title.

---

## 2. Dynamic Single-Page Application (SPA) Changes
**Goal:** Verify that the "Original Title" tracker correctly handles sites that change their own titles natively via JavaScript (e.g., watching consecutive videos on YouTube).
*   **Step 2.1:** Navigate to a YouTube video from the test list.
    *   *Expected:* Title immediately changes to **"YT: [Video_ID]"**.
*   **Step 2.2:** Click on a *different* video in the sidebar. Do not use a hard refresh, let the SPA navigate natively.
    *   *Expected:* The title briefly resets to the native title of Video 2, but the extension immediately intercepts it and replaces it with **"YT: [Video_ID_2]"**.
*   **Step 2.3:** Go to Options, find the YouTube rule, and disable it.
    *   *Expected:* The tab instantly reverts exactly to Video 2's native title (not Video 1's title!).

---

## 3. Discarded Tabs - Mode A: Enabled Wake-Up
**Goal:** Verify the extension can forcibly update a suspended tab's title via the full reload cycle.
*   **Step 3.1:** In Options -> "Additional Options", ensure **"Reload discarded tabs after rules are added, changed, or deleted"** is **CHECKED**.
*   **Step 3.2:** Ensure **"Discard these tabs after X seconds"** is checked and set to 3 seconds.
*   **Step 3.3:** Open `https://www.amazon.com/dp/B07PPD396V`. Ensure title is **"Amazon: B07PPD396V"**.
*   **Step 3.4:** Force the tab to discard. *(Tip: In Firefox, you can open about:memory, click 'Minimize memory usage' repeatedly, or leave the tab alone until it suspends)*.
*   **Step 3.5:** In Options, manually edit the Amazon rule from **"Amazon: $1"** to **"AZ: $1"** and save.
    *   *Expected:* The discarded Amazon tab wakes up, loading natively. Once loading is complete, the extension applies **"AZ: B07PPD396V"**, waits 3 seconds, and the tab correctly suspends itself again.

---

## 4. Discarded Tabs - Mode B: Do Nothing
**Goal:** Verify the extension respects ignoring discarded tabs and allows them to self-correct upon the next natural activation.
*   **Step 4.1:** In Options -> "Additional Options", ensure **"Reload discarded tabs after rules are added, changed, or deleted"** is **UNCHECKED**.
*   **Step 4.2:** Open `https://www.ebay.com/itm/123456789`.
    *   *Expected:* Title is **"eBay: 123456789"**.
*   **Step 4.3:** Force the tab to discard.
*   **Step 4.4:** In Options, delete the eBay rule.
    *   *Expected:* The eBay tab remains suspended. Visually, the Firefox tab bar *still* says "eBay: 123456789" (this is the physical API constraint).
*   **Step 4.5:** Click on the suspended eBay tab to activate it.
    *   *Expected:* The tab reloads natively and pulls its true native title. Because the rule was deleted, the Title Tamer engine evaluates, finds no match, and leaves the tab alone. Perfect self-correction!

---

## 5. Stress Testing Edge Cases
*   **Step 5.1:** **Import Overwrite Sync:** Import `test_patterns.json` while having 10 live open tabs matching various URLs. 
    *   *Expected:* All 10 tabs instantly swap to the imported definitions without a single page reload (unless discarded with wake-up enabled).
*   **Step 5.2:** **Hard Refresh:** Navigate to matching URL, check manipulated title, perform Hard Refresh (Ctrl+F5 or Shift+Refresh). 
    *   *Expected:* The `tabs.onUpdated` listener correctly registers the native title pipeline and immediately enforces the manipulated title again. No tracker memory loops or duplicate overwrites.
*   **Step 5.3:** **Simultaneous Native Override:** Navigate to a site that actively fights you via constant `setInterval` or SPA re-hydration (e.g., `https://www.costco.com/fish-oil-omega-3.html` with a matching rule).
    *   *Expected:* **Zero flickering.** The extension injects a `MutationObserver` guard directly into the page that synchronously re-asserts the custom title whenever the site's JavaScript attempts to change it. Because this runs inside the page's own JS context, it wins the race with zero round-trip latency. The tab title should lock to the custom value immediately after page load and never visually revert to the site's title. Application stability is also expected (no crashes, no infinite loops).

---

## 6. Persistent Memory & Elephant Memory 🐘
**Goal:** Verify that the extension remembers original titles and modifications across reloads or rule deletions.
*   **Step 6.1:** Enable a rule for a site (e.g. GitHub -> "Repo: $1"). Verify title is manipulated.
*   **Step 6.2:** Reload the extension (Disable and Re-enable in `about:addons` or save any change in Options to trigger background reload).
*   **Step 6.3:** Disable the rule.
    *   *Expected:* The tab instantly reverts to its correct native title. (Proves `tabOriginalTitles` was successfully persisted and restored from storage).
*   **Step 6.4:** Delete the rule entirely and reload the extension.
    *   *Expected:* Sync engine identifies the "orphaned" modified title via persistent state and reverts it natively during the next sync.

---

## 7. Throttled Synchronization (The 2000 Tab Safeguard) 🛡️
**Goal:** Verify the rolling worker pool handles large-scale syncs without crashing the browser.
*   **Step 7.1:** In Options -> "Additional Options", set **"Max Concurrent Tabs"** to 5.
*   **Step 7.2:** Open 20+ tabs from the test list and ensure they are all discarded.
*   **Step 7.3:** Change a global rule that affects all those tabs and Save.
    *   *Expected:* The extension badge shows "20". The tabs are processed exactly 5 at a time. You should see them reload, update, and re-discard in batches.
    *   *Verification:* Check browser memory usage during this process; it should remain stable because reloads are throttled.

---

## 8. Skeptical Engine (Heuristic Recovery)
**Goal:** Verify the engine can reclaim "stuck" titles even when no memory record or active rule exists.
*   **Step 8.1:** Open a site and manually (via console) set its title to `HTTP30: Stale`. Ensure no rule matches this URL.
*   **Step 8.2:** Force the tab to discard.
*   **Step 8.3:** Run "Sync All Tabs".
    *   *Expected:* The Skeptical Engine Phase 1 should log: `Suspicious title prefix detected`. 
    *   *Expected:* Phase 2 wakes the tab, reloads it, and restores the native title because it matches the Title Tamer "Ghost" pattern (`HTTP\d*!`).

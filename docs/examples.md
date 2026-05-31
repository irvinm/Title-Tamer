# Title-Tamer Examples

This page provides various regex search patterns and title replacement templates you can use with Title-Tamer to organize your browser tabs.

---

## General Matching Examples

### Jira Issue Tracker
| Field | Details |
| :--- | :--- |
| **Search Pattern** | `jira.com\/browse\/(.*)` |
| **Title Template** | `JIRA - $1` |
| **Sample Tab URL** | `https://www.jira.com/browse/SOLDEF-843` |
| **Resulting Title** | `JIRA - SOLDEF-843` |
| **Explanation** | Matches and returns "SOLDEF-843" as match[1] using `$1`. |

### GitHub Repository
| Field | Details |
| :--- | :--- |
| **Search Pattern** | `https?:\/\/(www\.)?github\.com/([^/]+)/([^/]+)` |
| **Title Template** | `Repo: $2/$3` |
| **Sample Tab URL** | `https://github.com/irvinm/Title-Tamer` |
| **Resulting Title** | `Repo: irvinm/Title-Tamer` |
| **Explanation** | Matches and returns "irvinm" as match[2] and "Title-Tamer" as match[3]. |

### Stack Overflow Question
| Field | Details |
| :--- | :--- |
| **Search Pattern** | `https?:\/\/(www\.)?stackoverflow\.com\/questions\/\d+\/([^/]+)` |
| **Title Template** | `SO: $2` |
| **Sample Tab URL** | `https://stackoverflow.com/questions/68646141/regex-matching-the-entire-string-and-nothing-else` |
| **Resulting Title** | `SO: regex-matching-the-entire-string-and-nothing-else` |
| **Explanation** | Matches and returns "regex-matching-the-entire-string-and-nothing-else" as match[2]. |

### Google Search Query
| Field | Details |
| :--- | :--- |
| **Search Pattern** | `https?:\/\/www\.google\.com\/.*[?&]q=([^&]+)` |
| **Title Template** | `Google: $1` |
| **Sample Tab URL** | `https://www.google.com/search?client=firefox-b-1-d&q=url+regex+examples` |
| **Resulting Title** | `Google: url+regex+examples` |
| **Explanation** | Matches and returns "url+regex+examples" as match[1] using `$1`. |

### Google Domain (Catch-All)
| Field | Details |
| :--- | :--- |
| **Search Pattern** | `https?:\/\/([a-zA-Z0-9-]+\.)*google\.[a-z]+(\/\|$)` |
| **Title Template** | `Google (Any)` |
| **Sample Tab URL** | `https://www.google.com/search?client=firefox-b-1-d&q=url+regex+examples` |
| **Resulting Title** | `Google (Any)` |
| **Explanation** | Matches (http/https)://*.google.* that matches any domain with google in it. |

---

## Specific Matching Behaviors

### Specific Domain Example
| Field | Details |
| :--- | :--- |
| **Search Pattern** | `google\.com` |
| **Title Template** | `Google (USA)` |
| **Sample Tab URL** | `https://www.google.com/search?client=firefox-b-1-d&q=url+regex+examples` |
| **Resulting Title** | `Google (USA)` |
| **Explanation** | Matches the domain "google.com" and replaces the title with "Google USA". |

### Substring Example
| Field | Details |
| :--- | :--- |
| **Search Pattern** | `firefox` |
| **Title Template** | `Firefox related` |
| **Sample Tab URLs** | • `https://www.mozilla.org/en-US/firefox/`<br>• `https://support.mozilla.org/en-US/kb/search-firefox-address-bar`<br>• `https://sigmaos.com/tips/browsers/how-to-copy-url-on-mozilla-firefox`<br>• `https://www.cnet.com/tech/computing/mozilla-streamlines-firefox-in-browser-rejuvenation-project/`<br>• `https://www.wikihow.com/Remove-Bing-from-Firefox` *(Will not match)* |
| **Resulting Title** | `Firefox related` |
| **Explanation** | Matches the substring "firefox" and replaces the title with "Firefox related" (case-sensitive). |

### Exact Match Example
| Field | Details |
| :--- | :--- |
| **Search Pattern** | `^https:\/\/firefox-source-docs\.mozilla\.org\/$` |
| **Title Template** | `Firefox Source Docs - Main Page` |
| **Sample Tab URLs** | • `https://firefox-source-docs.mozilla.org/` *(Matches)*<br>• `https://firefox-source-docs.mozilla.org/contributing/contribution_quickref.html` *(Does not match)* |
| **Resulting Title** | `Firefox Source Docs - Main Page` |
| **Explanation** | Matches the exact URL "https://firefox-source-docs.mozilla.org/", no more no less. |

---

## Advanced Parameter & Decode Handling (v0.9.4+)

### Handling Quoted Search Phrases
| Field | Details |
| :--- | :--- |
| **Search Pattern** | `q="([^"]+)"` |
| **Title Template** | `$1` |
| **Sample Tab URL** | `https://somewebsite.com/?q=%22exact+phrase%22` *(Matches)*<br>`https://somewebsite.com/?q=non-quoted-phrase` *(Does not match)* |
| **Resulting Title** | `exact+phrase` |
| **Explanation** | Automatically decodes `%22` into literal quotes (`"`) for matching and capturing. |

### Cleaner Titles for Spaces and Symbols
| Field | Details |
| :--- | :--- |
| **Search Pattern** | `topic=([^&]+)` |
| **Title Template** | `Topic: $1` |
| **Sample Tab URL** | `https://docs.example.com/search?topic=My%20Project%2BDesign` *(Matches)*<br>`https://docs.example.com/search?q=something-else` *(Does not match)* |
| **Resulting Title** | `Topic: My Project+Design` |
| **Explanation** | Decodes `%20` (space) and `%2B` (`+`) in the captured group for a human-readable title. |

### International/Unicode Support
| Field | Details |
| :--- | :--- |
| **Search Pattern** | `q=(你好)` |
| **Title Template** | `$1` |
| **Sample Tab URL** | `https://example.com/search?q=%E4%BD%A0%E5%A5%BD` *(Matches)*<br>`https://example.com/search?q=%E4%B8%96%E7%95%8C` *(Does not match)* |
| **Resulting Title** | `你好` |
| **Explanation** | Decodes UTF-8 encoding so you can use actual Unicode characters in your search patterns. |

---

## Advanced Formatting & Method Chaining (v1.3.0+)

Title-Tamer supports dot-notation method chains on regex capture groups. This allows you to sanitize, format, and limit the length of captured URL segments before they are inserted into your tab title.

### Upper Casing & Trimming
| Field | Details |
| :--- | :--- |
| **Search Pattern** | `jira\.com\/browse\/([^/]+)` |
| **Title Template** | `Ticket: $1.upper().trim()` |
| **Sample Tab URL** | `https://jira.com/browse/%20tit-123%20` |
| **Resulting Title** | `Ticket: TIT-123` |
| **Explanation** | Capture groups are automatically decoded (converting `%20` to spaces) before methods run. `.upper()` converts it to uppercase, and `.trim()` strips the surrounding spaces. |

### Replacing & Title Casing Slugs
| Field | Details |
| :--- | :--- |
| **Search Pattern** | `wiki\/([^/]+)` |
| **Title Template** | `Wiki: $1.replace("_", " ").title()` |
| **Sample Tab URL** | `https://en.wikipedia.org/wiki/advanced_string_formatting` |
| **Resulting Title** | `Wiki: Advanced String Formatting` |
| **Explanation** | Replaces underscores with spaces and capitalizes the first letter of each word (Title Case). |

### Title Truncation with Suffix
| Field | Details |
| :--- | :--- |
| **Search Pattern** | `article\/([^/]+)` |
| **Title Template** | `$1.limit(15, "...")` |
| **Sample Tab URL** | `https://blog.com/article/unnecessarily-long-slug-here` |
| **Resulting Title** | `unnecessarily-l...` |
| **Explanation** | Truncates the text to a maximum of 15 characters and appends `...` only if the text was actually truncated. |

### Title Truncation without Suffix
| Field | Details |
| :--- | :--- |
| **Search Pattern** | `article\/([^/]+)` |
| **Title Template** | `$1.limit(10)` |
| **Sample Tab URL** | `https://blog.com/article/unnecessarily-long-slug-here` |
| **Resulting Title** | `unnecessar` |
| **Explanation** | Truncates the text to a maximum of 10 characters with no trailing suffix (default behavior when only the length is specified). |

### Slice Sub-segments
| Field | Details |
| :--- | :--- |
| **Search Pattern** | `code\/([^/]+)` |
| **Title Template** | `Code: $1.slice(0, 4)` |
| **Sample Tab URL** | `https://example.com/code/abcdefg` |
| **Resulting Title** | `Code: abcd` |
| **Explanation** | Extracts a substring starting from index 0 up to (but not including) index 4. |

### Graceful Fallback Safety
| Field | Details |
| :--- | :--- |
| **Search Pattern** | `wiki\/([^/]+)` |
| **Title Template** | `$1.invalidMethod().upper()` |
| **Sample Tab URL** | `https://en.wikipedia.org/wiki/slug` |
| **Resulting Title** | `$1.invalidMethod().upper()` |
| **Explanation** | If an unknown method or syntax error is encountered, Title-Tamer falls back safely to treating the expression as literal text rather than crashing. |
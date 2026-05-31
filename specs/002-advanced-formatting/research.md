# Research: Capture Group Transformation Engine

## Security Constraints: Manifest V3 CSP
Chrome Extension Manifest V3 enforces a strict Content Security Policy (CSP) that bans the use of dynamic code execution features:
- `eval()` is forbidden.
- `new Function()` is forbidden.
- Dynamically loaded external scripts are forbidden.

Because of this, we **cannot** compile the user-defined expressions (e.g. `$1.upper()`) into JavaScript code and execute them. We must build a **custom lexer/interpreter** that parses the expression into a safe intermediate representation (Abstract Syntax Tree / Call Chain) and executes standard JavaScript string methods manually.

## Lexer and Parser Strategy
An expression like `$1.replace("-", " ").title().limit(10, "...")` contains a variable index followed by a chain of method calls with arguments.

### Alternative A: Backtracking RegEx Parser
Use a complex regex to extract methods and arguments:
`/\.([a-zA-Z_]\w*)\(([^)]*)\)/g`
- **Drawback**: Fails when arguments contain parentheses, such as `.replace("(", "[")` or nested quotes.
- **Verdict**: Rejected due to fragility.

### Alternative B: Character-by-Character Parser (State Machine)
Scan the string sequentially to extract:
1. Capture group number: `$1`, `$2`
2. Followed by methods: `.upper()`, `.slice(...)`
Track quote boundaries (`'` and `"`) and escape characters (`\`) to correctly parse arguments without breaking on inner parentheses.
- **Pros**: Highly robust, handles quotes, nested characters, and escaping correctly.
- **Verdict**: Selected.

## Method Execution Specifications

- **`.upper()`**: Map to `String.prototype.toUpperCase()`.
- **`.lower()`**: Map to `String.prototype.toLowerCase()`.
- **`.trim()`**: Map to `String.prototype.trim()`.
- **`.capitalize()`**: Map to custom capitalization:
  ```javascript
  str.charAt(0).toUpperCase() + str.slice(1).toLowerCase()
  ```
- **`.title()`**: Uppercase first letter of each word. We will split on word boundaries (`\b`) to support both spaces and dashes/underscores:
  ```javascript
  str.replace(/\b([a-z])/gi, char => char.toUpperCase())
  ```
- **`.replace(old, new)`**: Replace all occurrences. Since Chrome/Firefox support modern JS engines, we can use `String.prototype.replaceAll` or escape `old` for a global regex replace.
- **`.limit(n, suffix)`**:
  ```javascript
  const limitVal = parseInt(n, 10);
  const suffixVal = suffix !== undefined ? suffix : "";
  if (str.length > limitVal) {
      return str.substring(0, limitVal) + suffixVal;
  }
  return str;
  ```
- **`.slice(start, end)`**: Map to `String.prototype.slice(start, end)`. Convert parameters to integers:
  ```javascript
  str.slice(parseInt(start, 10), end !== undefined ? parseInt(end, 10) : undefined)
  ```

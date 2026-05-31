# Contract: Pattern Utility Replacements

This document defines the interface and API contract for the updated `pattern-utils.js` functions.

## Exposed Functions

### `buildTitle(titleTemplate, matches)`

Resolves all capture group variables and transformation chains within the template.

- **Parameters**:
  - `titleTemplate` (`string`): The replacement title template (e.g. `"$1.upper() - $2"`).
  - `matches` (`RegExpMatchArray`): The regex match results from the URL match.
- **Returns**: `string` - The formatted page title.
- **Contract**:
  - Unmatched capture groups (e.g. `$2` when only 1 group matched) must resolve to `""`.
  - Malformed dot-notation expressions must degrade gracefully and output as literals (e.g., `$1.replace(` evaluates to the literal string `$1.replace(`).
  - Encoded URL sequences in capture groups must be decoded at the group level *before* methods are processed.

## Internal Processing Functions

### `parseExpressionChain(input, startIndex)`

Parses a single capture group expression (e.g., `$1.trim().upper()`) starting from a specific index.

- **Parameters**:
  - `input` (`string`): The full title template.
  - `startIndex` (`number`): The index of the `$` character.
- **Returns**: `ExpressionChain | null`
  - Returns `null` if the syntax is invalid or there are no method calls.
  - Returns the parsed `ExpressionChain` and the end index of the expression if successful.

### `executeTransform(value, methodCall)`

Applies a single parsed transformation method to a string.

- **Parameters**:
  - `value` (`string`): The current string state.
  - `methodCall` (`MethodCall`): The parsed method call name and arguments.
- **Returns**: `string` - The transformed string.
- **Contract**:
  - Unknown method names must trigger a fallback exception (which bubbles up to treat the whole chain as literal).
  - Parameter types must be coerced safely (e.g. string bounds for `.limit` or `.slice`).

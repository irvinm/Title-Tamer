# Data Model: Formatting Expression AST

This document specifies the intermediate data structures used by the Replacement Engine to parse and execute capture group transformations.

## 1. Expression Call Chain (AST)

An expression call chain represents the capture group and the sequence of method calls applied to it.

### Abstract Structure

```typescript
interface ExpressionChain {
  groupNumber: number;        // The regex capture group index (e.g., 1 for $1)
  rawExpression: string;      // The raw matched expression (e.g. "$1.upper()")
  methods: MethodCall[];      // Ordered list of transformations to apply
}

interface MethodCall {
  name: string;               // Name of the method (e.g., "replace", "upper")
  args: Array<string | number>; // Parsed and evaluated arguments
}
```

### JSON Example

For the template `$1.replace("-", " ").upper()`:

```json
{
  "groupNumber": 1,
  "rawExpression": "$1.replace(\"-\", \" \").upper()",
  "methods": [
    {
      "name": "replace",
      "args": ["-", " "]
    },
    {
      "name": "upper",
      "args": []
    }
  ]
}
```

## 2. Argument Types

- **String Arguments**: Parsed from quote-bounded literals (`'...'` or `"..."`). Escaped characters (`\n`, `\t`, `\'`, `\"`, `\\`) are unescaped by the parser.
- **Numeric Arguments**: Parsed from unquoted integers. Negative signs are supported.

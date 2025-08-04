# @metriport/eslint-rules

Custom ESLint rules for Metriport's monorepo.

## Rules

### require-script-docstring

Requires that all TypeScript files in `packages/utils` have a docstring comment explaining the script's purpose.

#### Rule Details

This rule enforces that utility scripts have proper documentation to explain their purpose and usage. The docstring should be:

- A multi-line block comment (`/* */` style)
- Placed after all imports but before any variable or function definitions
- Substantial enough to explain the script's purpose (minimum 20 characters)

The rule will highlight the first line of code that needs a docstring comment above it, making it easy to identify exactly where to add the documentation.

#### Examples

✅ **Valid** - Script with proper docstring:

```typescript
import * as dotenv from "dotenv";
dotenv.config();
import { someUtil } from "somewhere";
import dayjs from "dayjs";

dayjs.extend(duration); // Setup code like this is ignored

/**
 * This script processes patient data and generates reports.
 * It connects to the database and exports consolidated information.
 *
 * Execute this with:
 * $ npm run process-patients
 */

const patientIds = []; // First actual code
async function main() {}
```

❌ **Invalid** - Script without docstring:

```typescript
import { someUtil } from "somewhere";

const data = "test"; // ← Error will underline this line
function main() {} //   "Missing docstring comment. Add a block comment..."
```

❌ **Invalid** - Script with insufficient documentation:

```typescript
import { someUtil } from "somewhere";

/* short comment */
const data = "test"; // ← Error will underline this line (comment too short)
```

❌ **Invalid** - Script with setup code but no docstring:

```typescript
import * as dotenv from "dotenv";
dotenv.config(); // Setup code (ignored)
import { getEnvVarOrFail } from "@metriport/core/util/env-var";

async function main() {
  // ← Error will underline this line
  // Script logic here   //   (first meaningful code after setup)
}
```

#### Files Excluded from Rule

The following types of files are automatically excluded:

**Files with exports (modules/libraries):**

```typescript
// Excluded - has named export
export const someUtil = () => {};

// Excluded - has default export
export default function helper() {}

// Excluded - has re-export
export { something } from "./somewhere";

// Excluded - has module.exports
module.exports = { data: "test" };
```

**Exception: Commander.js CLI scripts (still require docstrings even with exports):**

```typescript
// NOT excluded - uses commander for CLI parsing
import { Command } from "commander";

/**
 * This script processes data via command line interface.
 * Use --help to see available options.
 */

const program = new Command();
program.option("-f, --file <path>", "input file");
export default program; // Export is allowed for commander scripts
```

**Test files:**

```typescript
// Excluded - path contains __tests__
// packages/utils/src/something/__tests__/test-file.ts
```

#### Configuration

The rule is automatically enabled with `error` level in the `recommended` configuration for files in `packages/utils/*.ts`.

#### Notes

- Only applies to TypeScript files (`.ts`) in the `packages/utils/src` directory
- Excludes test files (any path containing `__tests__`)
- Excludes files with exports (modules/libraries, not standalone scripts)
- **Exception**: Files using Commander.js are considered scripts even if they export
- Ignores common setup calls like `dotenv.config()` and `dayjs.extend()`
- Does not apply to files outside `packages/utils`
- Does not apply to non-TypeScript files

### no-named-arrow-functions

Disallows arrow functions from being assigned to variables. Use function declarations instead.

## Usage

This package is already configured in the monorepo's ESLint setup. The rules are automatically applied based on the file location and type.

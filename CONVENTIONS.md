- Use the Onion Pattern to organize a package's code in layers.
- Try to use immutable code and avoid sharing state across different functions, objects, and systems.
  - Also prefer `const` instead of `let` whenever possible.
- Try to build code that's idempotent whenever possible.
- Prefer functional programming style functions: small, deterministic, 1 input, 1 output.
- Minimize coupling / dependencies:
  - Don’t modify objects received as parameter;
  - Don’t pass objects/data structures to functions expecting they’ll be modified - use the
    result/return of the function instead.
- Only add comments to code to explain why something was done, not how it works.
- Naming:
  - classes, enums: `PascalCase`;
  - constants, variables, functions: `camelCase`;
  - file names: `kebab-case`;
  - table and column names: `snake_case`;
  - Use meaningful names, so whoever is reading the code understands what it means;
  - Don’t use negative names, like `notEnabled`, prefer `isDisabled`;
  - For numeric values, if the type doesn’t convey the unit, add the unit to the name.
- Typescript (and Javascript when applicable, just disconsider the items related to types)
  - Use types whenever possible.
  - Avoid `any` and casting from `any` to other types.
  - Type predicates: only applicable to narrow down the type, not to force a complete type conversion
    without prior verification of its contents.
  - Prefer deconstructing parameters for functions instead of multiple parameters that might be of
    the same type (e.g., `fn({ a, b }: {a: string; b: string})` instead of `fn(a: string, b: string)`).
  - Don’t use `null` inside the app, only on code interacting with external interfaces/services,
    like DB and HTTP; convert to `undefined` before sending inwards into the code.
  - Use `async/await` instead of `.then()`.
  - Use the strict equality operator (===), don’t use abstract equality operator (==).
  - When calling a Promise-returning function asynchronously (i.e., not awaiting), use `.catch()` to
    handle errors (see `processAsyncError` and `emptyFunction` depending on the case).
  - Dates and Times
    - We want to always use `buildDayjs()` from `@metriport/shared` when initializing `dayjs` so we
      can avoid having dates created in different timezones.
- Prefer Nullish Coalesce (??) than the OR operator (||) when you want to provide a default value.
- Avoid creating arrow functions.
- Use truthy syntax instead of `in` - i.e., `if (data.link)` not `if ('link' in data)`.
- Error handling:
  - While handling errors, keep the stack trace around: if you create a new Error, pass the original
    error as the new one’s `cause` so the stack trace is persisted.
  - Error messages should have a static message so they can be easily grouped in tools like Sentry.
    Add dynamic data to the extra property and/or the MetriportError's `additionalInfo` property.
  - Avoid sending multiple events to Sentry for a single error.
- Global constants and variables:
  - move literals to constants declared after imports when possible (avoid magic numbers);
  - avoid shared, global objects - prefer creating them inside functions - most of the time, the
    benefits of having them as globals are negligible, but they introduce risk of bad state management,
    coupling and make it harder to test.
- Avoid using `console.log` and `console.error` in packages other than utils, infra and shared,
  and try to use `out().log` instead: `const { log } = out("prefix"); log("message");`
- Avoid multi-line logs, so:
  - don't send objects as a second parameter to `console.log()` or `out().log()`;
  - don't create multi-line strings when using `JSON.stringify()`.
- Use `eslint` to enforce code style.
- Use `prettier` to format code.
- max column length is 100 chars.
- multi-line comments use `/** */`.
- top-level comments go after the import (save pre-import to basic file header, like license).

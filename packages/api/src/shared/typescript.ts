/**
 * VSCode doesn't expand complex types on the inspector properly,
 * when those types are more complex.
 *
 * This is just a hack, work around to display complex types
 * on VSCode's inspector (hovering the mouse over a type).
 *
 * This is the issue to fix this:
 * https://github.com/microsoft/vscode/issues/94679
 *
 * These are marked as @deprecated so we don't keep them around,
 * they are just for local environemnts and shouldn't be used
 * to update actual domain types sent to remote branches.
 *
 * Based on: https://stackoverflow.com/a/57683652/2099911
 */

/**
 * Expands object types one level deep
 * @deprecated should not be part of our codebase other than this file
 */
export type Expand<T> = T extends infer O ? { [K in keyof O]: O[K] } : never;

/**
 * Expands object types recursively
 * @deprecated should not be part of our codebase other than this file
 */
export type ExpandRecursively<T> = T extends object
  ? T extends infer O
    ? { [K in keyof O]: ExpandRecursively<O[K]> }
    : never
  : T;

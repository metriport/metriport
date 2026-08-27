/**
 * Lazy import chalk to avoid crashes when it's not installed in production.
 * Returns passthrough functions if chalk is unavailable.
 */
export function getChalk() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const chalk = require("chalk");
    return chalk;
  } catch {
    // If chalk is not available, return passthrough functions
    return {
      cyan: (s: string) => s,
      yellow: (s: string) => s,
      green: (s: string) => s,
      magenta: (s: string) => s,
      blue: (s: string) => s,
      gray: (s: string) => s,
      dim: (s: string) => s,
      red: (s: string) => s,
    };
  }
}

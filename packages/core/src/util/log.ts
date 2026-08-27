import { emptyFunction } from "@metriport/shared";
import { getChalk } from "./chalk-loader";
import { Config } from "./config";
import { getRequestIdSafe } from "./request";

type LogParamBasic = string | number | boolean | unknown | null | undefined;
export type LogParam = LogParamBasic | (() => LogParamBasic);
export type Logger = ReturnType<typeof out>;
export type LogFunction = Logger["log"];

function colorizeRequestId(reqId: string): string {
  if (Config.isCloudEnv()) return reqId;
  const chalk = getChalk();
  return chalk.cyan(reqId);
}

/**
 * Colorizes label-value pairs with labels in dim gray and values in gray
 * Matches generic pattern: label followed by space/colon and a value (UUID or identifier)
 */
function colorizeKeyValuePairs(text: string): string {
  if (Config.isCloudEnv()) return text;
  const chalk = getChalk();

  // Generic pattern: word (label) followed by space or colon, then a value
  // Value can be: UUID, hex ID, or other alphanumeric identifier
  // Match patterns like:
  // - "requestId 019ad189-406e-7511-a5a4-74dabb806401"
  // - "cx: cdb678ab-07e3-42c5-93f5-5541cf1f15a8"
  // - "patient 019ac25b-9a0e-73a9-996a-2fd6c552d76b"

  // Pattern breakdown:
  // (\w+) - captures the label (any word)
  // ([:\s]+) - captures the delimiter (colon or space)
  // ([0-9a-f]{8,}-[0-9a-f-]+) - captures UUID-like values (flexible UUID pattern)
  const uuidPattern = /(\w+)([:\s]+)([0-9a-f]{8,}-[0-9a-f-]+)/gi;

  return text.replace(uuidPattern, (_match, label, delimiter, value) => {
    // Label is dimmed (lighter gray), value is gray (slightly less light)
    return chalk.dim(label) + delimiter + chalk.gray(value);
  });
}

function colorizeLogPrefix(prefix: string): string {
  if (Config.isCloudEnv()) return `[${prefix}]`;
  const chalk = getChalk();

  // Split on " - " to separate component name from key-value pairs
  // Pattern: [ComponentName - key value, key value]
  const dashIndex = prefix.indexOf(" - ");

  if (dashIndex > 0) {
    const componentName = prefix.substring(0, dashIndex);
    const rest = prefix.substring(dashIndex);

    // Component name in yellow to make it pop
    const colorizedComponent = chalk.yellow(componentName);
    // Colorize key-value pairs in the rest
    const colorizedRest = colorizeKeyValuePairs(rest);

    return `[${colorizedComponent}${colorizedRest}]`;
  }

  // If no dash, check if it has key-value pairs
  // If it has UUIDs, colorize them; otherwise colorize the whole prefix as component name
  if (prefix.match(/[0-9a-f]{8,}-[0-9a-f-]+/i)) {
    const colorizedContent = colorizeKeyValuePairs(prefix);
    return `[${colorizedContent}]`;
  }

  // Just a component name without key-value pairs, make it yellow (but keep brackets uncolored)
  return `[${chalk.yellow(prefix)}]`;
}

export function log(prefix?: string, suffix?: string): typeof console.log {
  return (msg: string, ...optionalParams: LogParam[]): void => {
    const actualPrefix = prefix ? `${colorizeLogPrefix(prefix)} ` : ``;

    const reqId = getRequestIdSafe();
    const reqPrefix = reqId ? `${colorizeRequestId(reqId)} ` : "";

    const actualParams = (optionalParams ?? []).map(p => (typeof p === "function" ? p() : p));
    return console.log(
      `${reqPrefix}${actualPrefix}${msg}`,
      ...[...actualParams, ...(suffix ? [suffix] : [])]
    );
  };
}

export function debug(prefix?: string, suffix?: string): typeof console.log {
  if (Config.isCloudEnv()) return emptyFunction;
  return log(prefix, suffix);
}

export function out(prefix?: string, suffix?: string) {
  return {
    log: log(prefix, suffix),
    debug: debug(prefix, suffix),
  };
}

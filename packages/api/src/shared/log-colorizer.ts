import { getChalk } from "@metriport/core/util/chalk-loader";
import { Config } from "./config";

function isColorEnabled(): boolean {
  return !Config.isCloudEnv();
}

/**
 * Colorizes a request ID in cyan
 */
export function colorizeRequestId(reqId: string): string {
  if (!isColorEnabled()) return reqId;
  const chalk = getChalk();
  return chalk.cyan(reqId);
}

/**
 * Colorizes an HTTP method in magenta
 */
export function colorizeHttpMethod(method: string): string {
  if (!isColorEnabled()) return method;
  const chalk = getChalk();
  return chalk.magenta(method);
}

/**
 * Colorizes HTTP method + route together for visual distinction
 */
export function colorizeHttpMethodAndRoute(method: string, route: string): string {
  if (!isColorEnabled()) return `${method} ${route}`;
  const chalk = getChalk();
  return chalk.magenta(`${method} ${route}`);
}

/**
 * Colorizes an HTTP status code based on its range
 * - 2xx: green (success)
 * - 3xx: cyan (redirect)
 * - 4xx: yellow (client error)
 * - 5xx: red (server error)
 */
export function colorizeStatusCode(statusCode: number): string {
  if (!isColorEnabled()) return statusCode.toString();
  const chalk = getChalk();

  if (statusCode >= 200 && statusCode < 300) {
    return chalk.green(statusCode.toString());
  } else if (statusCode >= 300 && statusCode < 400) {
    return chalk.cyan(statusCode.toString());
  } else if (statusCode >= 400 && statusCode < 500) {
    return chalk.yellow(statusCode.toString());
  } else if (statusCode >= 500) {
    return chalk.red(statusCode.toString());
  }
  return statusCode.toString();
}

/**
 * Colorizes metadata or context information in dim gray
 */
export function colorizeMetadata(text: string): string {
  if (!isColorEnabled()) return text;
  const chalk = getChalk();
  return chalk.dim(text);
}

/**
 * Colorizes timing information in cyan
 */
export function colorizeDuration(duration: string): string {
  if (!isColorEnabled()) return duration;
  const chalk = getChalk();
  return chalk.cyan(duration);
}

/**
 * Colorizes SQL queries with first word in blue and rest dimmed/darker
 */
export function colorizeSqlQuery(query: string): string {
  if (!isColorEnabled()) return query;
  const chalk = getChalk();

  // Match the first word (SQL command like SELECT, INSERT, UPDATE, etc.)
  const match = query.match(/^\s*(\w+)/);
  if (match) {
    const firstWord = match[1];
    const restOfQuery = query.substring(match[0].length);
    // First word is blue, rest is dimmed (darker) to differentiate from app logs
    return chalk.blue(firstWord) + chalk.dim(restOfQuery);
  }

  return chalk.dim(query);
}

/**
 * Colorizes a log prefix (the text in square brackets) in a distinct color
 */
export function colorizeLogPrefix(prefix: string): string {
  if (!isColorEnabled()) return `[${prefix}]`;
  const chalk = getChalk();
  return chalk.yellow(`[${prefix}]`);
}

/**
 * Colorizes transaction/execution identifiers in cyan
 */
export function colorizeTransactionId(id: string): string {
  if (!isColorEnabled()) return id;
  const chalk = getChalk();
  return chalk.cyan(id);
}

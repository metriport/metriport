import { emptyFunction } from "@metriport/shared";
import { Config } from "./config";
import { getRequestIdSafe } from "./request";
import * as fs from "fs";
import * as path from "path";

const LOGS_DIR = path.join(process.cwd(), "logs");
const DEV_LOG_FILE = path.join(LOGS_DIR, "dev.log");

// Ensure logs directory exists and clean up old log file to avoid growing the file infinitely
if (Config.isDev()) {
  if (!fs.existsSync(LOGS_DIR)) {
    fs.mkdirSync(LOGS_DIR, { recursive: true });
  }
  if (fs.existsSync(DEV_LOG_FILE)) {
    // Keep only last 100 lines
    const data = fs.readFileSync(DEV_LOG_FILE, "utf8");
    const lines = data.split("\n");
    if (lines.length > 100) {
      const lastLines = lines.slice(-100).join("\n");
      fs.writeFileSync(DEV_LOG_FILE, lastLines);
    }
  }
}

type LogParamBasic = string | number | boolean | unknown | null | undefined;
export type LogParam = LogParamBasic | (() => LogParamBasic);
export type Logger = ReturnType<typeof out>;

/**
 * Writes to the dev.log file used for filtering and slicing logs during local development.
 * @param data - The data to write to the file.
 * @returns void
 */
function writeToFile(data: unknown): void {
  if (Config.isCloudEnv()) return;

  const logEntry = JSON.stringify(data) + "\n";
  fs.appendFileSync(DEV_LOG_FILE, logEntry);
}

export function structuredLog(source?: string) {
  return (msg: Record<string, unknown>, ...optionalParams: LogParam[]): void => {
    const reqId = getRequestIdSafe();

    const actualParams = (optionalParams ?? []).map(p => (typeof p === "function" ? p() : p));
    const structuredMsg = {
      ...msg,
      ...actualParams,
      timestamp: new Date().toISOString(),
      requestId: reqId,
      source,
    };

    writeToFile(structuredMsg);
    return console.log(structuredMsg);
  };
}

export function log(prefix?: string, suffix?: string) {
  if (Config.isDev()) return emptyFunction;
  return (msg: string, ...optionalParams: LogParam[]): void => {
    const actualPrefix = prefix ? `[${prefix}] ` : ``;

    const reqId = getRequestIdSafe();
    const reqPrefix = reqId ? `${reqId} ` : "";

    const actualParams = (optionalParams ?? []).map(p => (typeof p === "function" ? p() : p));
    return console.log(
      `${reqPrefix}${actualPrefix}${msg}`,
      ...[...actualParams, ...(suffix ? [suffix] : [])]
    );
  };
}

export function out(prefix?: string, suffix?: string) {
  // Function overloads
  function logWrapper(obj: Record<string, unknown>): void;
  function logWrapper(msg: string, ...optionalParams: LogParam[]): void;
  function logWrapper(
    msgOrObj: string | Record<string, unknown>,
    ...optionalParams: LogParam[]
  ): void {
    if (typeof msgOrObj === "object") {
      return structuredLog(prefix)({
        ...msgOrObj,
        source: prefix,
      });
    }

    const message = msgOrObj;
    const actualParams = (optionalParams ?? []).map(p => (typeof p === "function" ? p() : p));
    const actualParamsAsObject = actualParams.reduce((acc, param, idx) => {
      acc[`extraParam${idx + 1}`] = param;
      return acc;
    }, {} as Record<string, LogParam>);

    // The call to `log` is retained for 3 weeks in order to avoid a hard cutover to our new log format.
    // TODO: Remove this log call after the 3 week log retention period is over.
    log(prefix, suffix)(message, ...actualParams);
    structuredLog(prefix)({
      ...actualParamsAsObject,
      message,
      source: prefix,
    });
  }

  function debugWrapper(msg: string, ...optionalParams: LogParam[]) {
    if (Config.isCloudEnv()) return emptyFunction;
    return logWrapper(msg, ...optionalParams);
  }

  return {
    log: logWrapper,
    debug: debugWrapper,
  };
}

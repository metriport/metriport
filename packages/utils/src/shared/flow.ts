import { getFileContents } from "@metriport/core/util/fs";

/**
 * Returns whether the script should stop.
 *
 * Read the contents of the file at the path set in the `fileName` parameter.
 * If the contents match "stop", the script should stop.
 * Otherwise, the script should continue.
 * Defaults to continue.
 *
 * @returns boolean - true if the script should stop, false otherwise
 */
export function shouldStopScript({
  fileName = "should-stop-script.txt",
  log,
}: {
  fileName?: string;
  log?: typeof console.log;
} = {}): boolean {
  try {
    const shouldStopScriptRaw = getFileContents(fileName);
    const shouldStop = shouldStopScriptRaw.trim().toLowerCase() === "stop";
    if (shouldStop) {
      log && log("Stopping script...");
      return true;
    }
    log && log("Continuing script...");
  } catch (error) {
    // no-op
  }
  return false;
}

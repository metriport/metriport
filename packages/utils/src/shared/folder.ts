import fs from "fs";
import os from "os";

export const runsFolderName = "runs";

/**
 * Creates a symlink to the runs folder in the user's home directory
 */
export function initRunsFolder(subFolder?: string) {
  const homeDir = os.homedir();
  const dest = `${homeDir}/Documents/phi/runs`;
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }
  const pathName = `./${runsFolderName}`;
  try {
    fs.lstatSync(pathName);
  } catch (error) {
    fs.symlinkSync(dest, pathName);
  }
  if (subFolder) {
    const subFolderPath = `${pathName}/${subFolder}`;
    if (!fs.existsSync(subFolderPath)) {
      fs.mkdirSync(subFolderPath, { recursive: true });
    }
  }
}

/**
 * Returns a function that creates a directory path inside the folder:
 * - `./runs/${folder}/`
 *
 * Make sure to call `initRunsFolder` before using this function.
 *
 * @param folder the name of the folder inside ./runs
 */
export function buildGetDirPathInside(folder?: string) {
  return function (orgName?: string, extension?: string): string {
    return `${buildPathInsideRunsFolder(folder)}/${getFileNameForOrgWithTimestamp({
      orgName,
      timestamp: new Date(),
      extension,
    })}`;
  };
}

export function buildGetDirPathInsideNoTimestamp(folder?: string) {
  return function (orgName?: string, extension?: string): string {
    return `${buildPathInsideRunsFolder(folder)}/${getFileNameForOrgWithTimestamp({
      orgName,
      extension,
    })}`;
  };
}

export function buildPathInsideRunsFolder(folder?: string) {
  const basePathName = `./${runsFolderName}`;
  const pathName = basePathName + (folder ? `/${folder}` : "");
  return pathName;
}

export function getPathNameForOrg(orgName: string): string {
  return orgName.replace(/[,.]/g, "").replace("_", "-");
}

export function getTimestampForFilename(timestamp = new Date()): string {
  return new Date(timestamp).toISOString().replace(/[T]/g, "_").replace(/[:.]/g, "-");
}

export function getFileNameForOrgWithTimestamp({
  orgName,
  timestamp,
  extension,
}: {
  orgName?: string;
  timestamp?: Date;
  extension?: string;
}): string | undefined {
  if (!orgName) return undefined;
  const timestampAsStr = timestamp ? `_${getTimestampForFilename(timestamp)}` : "";
  const extensionAsStr = extension ? `.${extension}` : "";
  return `${getPathNameForOrg(orgName)}${timestampAsStr}${extensionAsStr}`;
}

import fs from "fs";
import os from "os";

export const runsFolderName = "runs";

/**
 * Creates a symlink to the runs folder in the user's home directory
 */
export function initRunsFolder() {
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
}

/**
 * Returns a function that creates a directory path inside the folder:
 * - `./runs/${folder}/`
 *
 * Make sure to call `initRunsFolder` before using this function.
 *
 * @param folder the name of the folder inside ./runs
 */
export function buildGetDirPathInside(folder: string) {
  return function (orgName: string): string {
    const pathName = `./${runsFolderName}/${folder}`;
    return `${pathName}/${getFileNameForOrg(orgName)}`;
  };
}

export function getFileNameForOrg(orgName: string, extension?: string): string {
  const ext = extension ? `.${extension}` : "";
  return `${orgName?.replace(/[,.]/g, "").replaceAll(" ", "-")}_${new Date().toISOString()}${ext}`;
}

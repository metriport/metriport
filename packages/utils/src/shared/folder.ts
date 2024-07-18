import fs from "fs";
import os from "os";

const runsFolderName = "runs";

/**
 * Creates a symlink to the runs folder in the user's home directory
 */
export function initRunsFolder() {
  const pathName = `./${runsFolderName}`;
  if (!fs.existsSync(pathName)) {
    const homeDir = os.homedir();
    fs.symlinkSync(`${homeDir}/Documents/phi/runs`, pathName);
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

function getFileNameForOrg(orgName: string, extension?: string): string {
  const ext = extension ? `.${extension}` : "";
  return `${orgName?.replace(/[,.]/g, "").replaceAll(" ", "-")}_${new Date().toISOString()}${ext}`;
}

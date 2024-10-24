import {
  fileExists as fileExistsFromCore,
  getFileContents as getFileContentsFromCore,
  getFileContentsAsync as getFileContentsAsyncFromCore,
  getFileNames as getFileNamesFromCore,
  isDirectory as isDirectoryFromCore,
  makeDir as makeDirFromCore,
  makeDirIfNeeded as makeDirIfNeededFromCore,
  writeFileContents as writeFileContentsFromCore,
} from "@metriport/core/util/fs";

/** @deprecated Use @metriport/core instead */
export function isDirectory(path: string): boolean {
  return isDirectoryFromCore(path);
}

/** @deprecated Use @metriport/core instead */
export function fileExists(path: string): boolean {
  return fileExistsFromCore(path);
}

/** @deprecated Use @metriport/core instead */
export function getFileNames({
  folder,
  recursive = false,
  extension,
}: {
  folder: string;
  recursive?: boolean;
  extension?: string;
}): string[] {
  return getFileNamesFromCore({ folder, recursive, extension });
}

/** @deprecated Use @metriport/core instead */
export function getFileContents(fileName: string): string {
  return getFileContentsFromCore(fileName);
}
/** @deprecated Use @metriport/core instead */
export function getFileContentsAsync(fileName: string): Promise<string> {
  return getFileContentsAsyncFromCore(fileName);
}

/** @deprecated Use @metriport/core instead */
export function writeFileContents(fileName: string, contents: string): void {
  return writeFileContentsFromCore(fileName, contents);
}

/** @deprecated Use @metriport/core instead */
export function makeDir(dir: string): void {
  return makeDirFromCore(dir);
}

/** @deprecated Use @metriport/core instead */
export function makeDirIfNeeded(fileName: string, base = "") {
  return makeDirIfNeededFromCore(fileName, base);
}

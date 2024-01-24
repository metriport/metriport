import * as fs from "fs";
import path from "path";

export function isDirectory(path: string): boolean {
  return fs.statSync(path).isDirectory();
}

export function fileExists(path: string): boolean {
  return fs.openSync(path, "r") !== undefined;
}

export function getFileNames({
  folder,
  recursive = false,
  extension,
}: {
  folder: string;
  recursive?: boolean;
  extension?: string;
}): string[] {
  const dirContents = fs.readdirSync(folder, {
    withFileTypes: true,
  });
  const isFileToBeIncluded = (f: fs.Dirent) => {
    if (!extension) return f.isFile();
    return f.isFile() && f.name.endsWith(extension);
  };
  const files = dirContents
    .filter(isFileToBeIncluded)
    .map(f => path.join(folder, path.sep, f.name));
  const directories = dirContents.filter(f => f.isDirectory()).map(f => f.name);
  if (recursive) {
    for (const directory of directories) {
      const subDirPath = path.join(folder, path.sep, directory);
      const subDirFiles = getFileNames({ folder: subDirPath, recursive, extension });
      files.push(...subDirFiles);
    }
  }
  return files;
}

export function getFileContents(fileName: string): string {
  return fs.readFileSync(fileName, "utf8");
}
export function getFileContentsAsync(fileName: string): Promise<string> {
  return new Promise((resolve, reject) => {
    fs.readFile(fileName, "utf8", (err, data) => {
      if (err) reject(err);
      else resolve(data);
    });
  });
}

export function writeFileContents(fileName: string, contents: string): void {
  fs.writeFileSync(fileName, contents);
}

export function makeDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}

export function makeDirIfNeeded(fileName: string, base = "") {
  if (!fileName.includes("/")) return;
  const dirName = fileName.split("/").slice(0, -1).join("/");
  makeDir(path.join(base, dirName));
}

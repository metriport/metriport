import fs from "fs";
import path from "path";

export function filePathIsInGitRepository(absolutePath: string): boolean {
  if (!path.isAbsolute(absolutePath)) {
    throw new Error("Path must be absolute. Received: " + absolutePath);
  }

  const gitDir = path.join(absolutePath, ".git");
  const parentDir = path.dirname(absolutePath);
  return (
    fs.existsSync(gitDir) ||
    (parentDir.length < absolutePath.length && filePathIsInGitRepository(parentDir))
  );
}

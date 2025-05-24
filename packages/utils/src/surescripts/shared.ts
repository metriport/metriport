import fs from "fs";
import path from "path";

export function filePathIsInGitRepository(absolutePath: string): boolean {
  const gitDir = path.join(absolutePath, ".git");
  const parentDir = path.dirname(absolutePath);
  return (
    fs.existsSync(gitDir) ||
    (parentDir.length < absolutePath.length && filePathIsInGitRepository(parentDir))
  );
}

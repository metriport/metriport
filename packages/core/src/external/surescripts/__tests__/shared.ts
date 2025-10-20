import fs from "fs";
import path from "path";

const ARTIFACT_DIR = path.join(__dirname, "artifacts");

export function getArtifact(name: string): Buffer {
  return fs.readFileSync(path.join(ARTIFACT_DIR, name));
}

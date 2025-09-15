import fs from "fs";
import path from "path";
import { InferRxNormCommandOutput } from "@aws-sdk/client-comprehendmedical";

const ARTIFACT_DIR = path.join(__dirname, "artifacts");

type RxNormArtifact = { inputText: string; response: InferRxNormCommandOutput };

export function getRxNormArtifact(name: string): RxNormArtifact {
  const jsonFile = fs.readFileSync(path.join(ARTIFACT_DIR, "rxnorm", name, "rxnorm.json"));
  return JSON.parse(jsonFile.toString()) as RxNormArtifact;
}

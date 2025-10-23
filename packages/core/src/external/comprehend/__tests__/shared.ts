import fs from "fs";
import path from "path";
import { InferRxNormCommandOutput } from "@aws-sdk/client-comprehendmedical";
import { Resource } from "@medplum/fhirtypes";

const ARTIFACT_DIR = path.join(__dirname, "artifacts");

type RxNormArtifact = { inputText: string; response: InferRxNormCommandOutput };

export function getRxNormArtifact(name: string): RxNormArtifact {
  const jsonFile = fs.readFileSync(path.join(ARTIFACT_DIR, "rxnorm", name, "rxnorm.json"), "utf8");
  return JSON.parse(jsonFile.toString()) as RxNormArtifact;
}

export function getFhirArtifact(api: "rxnorm" | "icd10cm" | "snomedct", name: string): Resource[] {
  const jsonFile = fs.readFileSync(path.join(ARTIFACT_DIR, api, name, "fhir.json"));
  return JSON.parse(jsonFile.toString()) as Resource[];
}

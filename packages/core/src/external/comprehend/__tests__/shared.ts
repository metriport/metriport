import fs from "fs";
import path from "path";
import { InferRxNormCommandOutput } from "@aws-sdk/client-comprehendmedical";
import { Resource } from "@medplum/fhirtypes";

const ARTIFACT_DIR = path.join(__dirname, "artifacts");

type RxNormArtifact = { inputText: string; response: InferRxNormCommandOutput };

export function getRxNormArtifact(name: string): RxNormArtifact {
  const jsonFile = fs.readFileSync(path.join(ARTIFACT_DIR, "rxnorm", name, "rxnorm.json"));
  if (!fs.existsSync(jsonFile)) {
    throw new Error(`RxNorm artifact ${name} not found`);
  }
  return JSON.parse(jsonFile.toString()) as RxNormArtifact;
}

export function getFhirArtifact(api: "rxnorm" | "icd10cm" | "snomedct", name: string): Resource[] {
  const jsonFile = fs.readFileSync(path.join(ARTIFACT_DIR, api, name, "fhir.json"));
  if (!fs.existsSync(jsonFile)) {
    throw new Error(`Fhir artifact ${name} not found`);
  }
  return JSON.parse(jsonFile.toString()) as Resource[];
}

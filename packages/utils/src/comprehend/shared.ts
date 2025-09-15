import { ComprehendClient } from "@metriport/core/external/comprehend/client";
import {
  InferICD10CMCommandOutput,
  InferRxNormCommandOutput,
  InferSNOMEDCTCommandOutput,
} from "@aws-sdk/client-comprehendmedical";
import fs from "fs";
import path from "path";

/**
 * Utility functions for building and caching the results of Comprehend Medical for use in automated testing.
 */
export type InferenceApi = "rxnorm" | "icd10cm" | "snomedct";
export type RxNormArtifact = { inputText: string; response: InferRxNormCommandOutput };
export type ConditionArtifact = { inputText: string; response: InferICD10CMCommandOutput };
export type SnomedCTArtifact = { inputText: string; response: InferSNOMEDCTCommandOutput };
type Artifact<T extends InferenceApi> = T extends "rxnorm"
  ? RxNormArtifact
  : T extends "icd10cm"
  ? ConditionArtifact
  : SnomedCTArtifact;

const TEST_DIR = path.join(process.cwd(), "../core/src/external/comprehend/__tests__/artifacts");

export function buildArtifact<I extends InferenceApi>(
  api: I,
  name: string,
  artifact: Artifact<I>
): void {
  const artifactPath = path.join(TEST_DIR, api, name, api + ".json");
  const artifactDir = path.dirname(artifactPath);
  if (!fs.existsSync(artifactDir)) {
    fs.mkdirSync(artifactDir, { recursive: true });
  }
  fs.writeFileSync(artifactPath, JSON.stringify(artifact, null, 2));
}

export function getArtifact<I extends InferenceApi>(api: I, name: string): Artifact<I> {
  const artifactPath = path.join(TEST_DIR, api, name, api + ".json");
  return JSON.parse(fs.readFileSync(artifactPath, "utf8")) as Artifact<I>;
}

export function listArtifactIds<I extends InferenceApi>(api: I): string[] {
  return fs.readdirSync(path.join(TEST_DIR, api)).filter(id => artifactExists(api, id));
}

function artifactExists<I extends InferenceApi>(api: I, name: string): boolean {
  const artifactPath = path.join(TEST_DIR, api, name, api + ".json");
  return fs.existsSync(artifactPath);
}

export async function buildRxNormArtifact({
  name,
  inputText,
}: {
  name: string;
  inputText: string;
}): Promise<void> {
  if (artifactExists("rxnorm", name)) {
    return;
  }
  const client = new ComprehendClient();
  const response = await client.inferRxNorm(inputText);
  buildArtifact("rxnorm", name, { inputText, response });
}

export async function buildConditionArtifact({
  name,
  inputText,
}: {
  name: string;
  inputText: string;
}): Promise<void> {
  if (artifactExists("icd10cm", name)) {
    return;
  }
  const client = new ComprehendClient();
  const response = await client.inferICD10CM(inputText);
  buildArtifact("icd10cm", name, { inputText, response });
}

export async function buildSnomedCTArtifact({
  name,
  inputText,
}: {
  name: string;
  inputText: string;
}): Promise<void> {
  if (artifactExists("snomedct", name)) {
    return;
  }
  const client = new ComprehendClient();
  const response = await client.inferSNOMEDCT(inputText);
  buildArtifact("snomedct", name, { inputText, response });
}

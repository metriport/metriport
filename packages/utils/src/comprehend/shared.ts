import {
  InferICD10CMCommandOutput,
  InferRxNormCommandOutput,
  InferSNOMEDCTCommandOutput,
} from "@aws-sdk/client-comprehendmedical";
import { Bundle, Resource } from "@medplum/fhirtypes";
import { createConsolidatedDataFileNameWithSuffix } from "@metriport/core/domain/consolidated/filename";
import { S3Utils } from "@metriport/core/external/aws/s3";
import { ComprehendClient } from "@metriport/core/external/comprehend/client";
import { Config } from "@metriport/core/util/config";
import { getEnvVarOrFail } from "@metriport/shared";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
const medicalDocsBucketName = getEnvVarOrFail("MEDICAL_DOCUMENTS_BUCKET_NAME");

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

export function writeFhirArtifact<I extends InferenceApi>(
  api: I,
  name: string,
  resources: Resource[]
): void {
  const artifactPath = path.join(TEST_DIR, api, name, "fhir.json");
  const artifactDir = path.dirname(artifactPath);
  if (!fs.existsSync(artifactDir)) {
    fs.mkdirSync(artifactDir, { recursive: true });
  }
  fs.writeFileSync(artifactPath, JSON.stringify(resources, null, 2));
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
}): Promise<Artifact<"rxnorm">> {
  if (artifactExists("rxnorm", name)) {
    return getArtifact("rxnorm", name);
  }
  const client = new ComprehendClient();
  const response = await client.inferRxNorm(inputText);
  const artifact = { inputText, response };
  buildArtifact("rxnorm", name, artifact);
  return artifact;
}

export async function buildConditionArtifact({
  name,
  inputText,
}: {
  name: string;
  inputText: string;
}): Promise<Artifact<"icd10cm">> {
  if (artifactExists("icd10cm", name)) {
    return getArtifact("icd10cm", name);
  }
  const client = new ComprehendClient();
  const response = await client.inferICD10CM(inputText);
  const artifact = { inputText, response };
  buildArtifact("icd10cm", name, artifact);
  return artifact;
}

export async function buildSnomedCTArtifact({
  name,
  inputText,
}: {
  name: string;
  inputText: string;
}): Promise<Artifact<"snomedct">> {
  if (artifactExists("snomedct", name)) {
    return getArtifact("snomedct", name);
  }
  const client = new ComprehendClient();
  const response = await client.inferSNOMEDCT(inputText);
  const artifact = { inputText, response };
  buildArtifact("snomedct", name, artifact);
  return artifact;
}

/**
 * Retrieves the consolidated bundle for a patient from S3.
 *
 * @param cxId - The customer ID
 * @param patientId - The patient ID
 * @returns The consolidated bundle, or undefined if not found
 */
export async function getConsolidatedBundle({
  cxId,
  patientId,
}: {
  cxId: string;
  patientId: string;
}): Promise<Bundle | undefined> {
  const s3Utils = new S3Utils(Config.getAWSRegion());
  const fileKey = createConsolidatedDataFileNameWithSuffix(cxId, patientId) + ".json";
  if (!(await s3Utils.fileExists(medicalDocsBucketName, fileKey))) {
    return undefined;
  }
  const fileContent = await s3Utils.downloadFile({ bucket: medicalDocsBucketName, key: fileKey });
  return JSON.parse(fileContent.toString());
}

/**
 * Opens a preview URL in the default browser using the macOS `open` command.
 *
 * @param url - The URL to open
 */
export function openPreviewUrl(url: string): void {
  execSync(`open https://preview.metriport.com/?url=${encodeURIComponent(url)}`);
}

/**
 * Writes a consolidated bundle preview to S3 and returns a signed URL.
 * The preview file is named with a "-preview.json" suffix.
 *
 * @param cxId - The customer ID
 * @param patientId - The patient ID
 * @param bundle - The FHIR bundle to write
 * @returns Promise resolving to a signed URL valid for 30 minutes
 */
export async function writeConsolidatedBundlePreview(
  cxId: string,
  patientId: string,
  bundle: Bundle
): Promise<string> {
  const s3Utils = new S3Utils(Config.getAWSRegion());

  const fileName = createConsolidatedDataFileNameWithSuffix(cxId, patientId) + "-preview.json";
  const fileContent = JSON.stringify(bundle);
  await s3Utils.uploadFile({
    bucket: medicalDocsBucketName,
    key: fileName,
    file: Buffer.from(fileContent),
    contentType: "application/json",
  });
  return await s3Utils.getSignedUrl({
    bucketName: medicalDocsBucketName,
    fileName,
    durationSeconds: 60 * 30,
  });
}

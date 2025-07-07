import fs from "fs";
import path from "path";
import csv from "csv-parser";
import { execSync } from "child_process";
import { Bundle } from "@medplum/fhirtypes";
import { S3Utils } from "@metriport/core/external/aws/s3";
import { getEnvVarOrFail } from "@metriport/shared";
import { createConsolidatedDataFileNameWithSuffix } from "@metriport/core/domain/consolidated/filename";
import { dangerouslyDeduplicateFhir } from "@metriport/core/fhir-deduplication/deduplicate-fhir";
import { buildLatestConversionBundleFileName } from "@metriport/core/external/surescripts/file/file-names";
import { Config } from "@metriport/core/util/config";

const medicalDocsBucketName = getEnvVarOrFail("MEDICAL_DOCUMENTS_BUCKET_NAME");

interface PatientTransmission {
  cxId: string;
  patientId: string;
  transmissionId: string;
}

export function getSurescriptsDirOrFail(): string {
  const dir = path.join(process.cwd(), "runs", "surescripts");
  if (!fs.existsSync(dir)) {
    throw new Error(
      "Surescripts directory not found. Please use `npm run surescripts` from the utils directory."
    );
  }
  return dir;
}

export function writeSurescriptsRunsFile(filePath: string, content: string): void {
  const dir = getSurescriptsDirOrFail();
  const fullFilePath = path.join(dir, filePath);
  const fileDir = path.dirname(fullFilePath);
  if (!fs.existsSync(fileDir)) {
    fs.mkdirSync(fileDir, { recursive: true });
  }
  fs.writeFileSync(fullFilePath, content, "utf-8");
}

export function openSurescriptsRunsFile(filePath: string): void {
  const dir = getSurescriptsDirOrFail();
  const fullFilePath = path.join(dir, filePath);
  if (fs.existsSync(fullFilePath)) {
    execSync(`open ${fullFilePath}`);
  } else {
    console.error(`File not found: ${fullFilePath}`);
  }
}

export function buildCsvPath(csvPath: string): string {
  if (csvPath.startsWith("/")) {
    return csvPath;
  }
  return path.join(process.cwd(), "runs/surescripts", csvPath);
}

export async function getTransmissionsFromCsv(
  cxId: string,
  csvData: string
): Promise<PatientTransmission[]> {
  return new Promise((resolve, reject) => {
    const transmissions: PatientTransmission[] = [];
    fs.createReadStream(csvData)
      .pipe(csv())
      .on("data", function (row) {
        transmissions.push({
          cxId,
          patientId: row.patient_id,
          transmissionId: row.transmission_id,
        });
      })
      .on("end", function () {
        resolve(transmissions);
      })
      .on("error", function (error) {
        reject(error);
      });
  });
}

export async function getConsolidatedBundle(
  cxId: string,
  patientId: string
): Promise<Bundle | undefined> {
  const s3Utils = new S3Utils(Config.getAWSRegion());
  const fileKey = createConsolidatedDataFileNameWithSuffix(cxId, patientId) + ".json";
  if (!(await s3Utils.fileExists(medicalDocsBucketName, fileKey))) {
    return undefined;
  }
  const fileContent = await s3Utils.downloadFile({ bucket: medicalDocsBucketName, key: fileKey });
  return JSON.parse(fileContent.toString());
}

export async function getConversionBundle(
  cxId: string,
  patientId: string
): Promise<Bundle | undefined> {
  const s3Utils = new S3Utils(Config.getAWSRegion());
  const fileName = buildLatestConversionBundleFileName(cxId, patientId);
  const bucketName = Config.getPharmacyConversionBucketName();
  if (!bucketName) {
    return undefined;
  }
  try {
    const fileContent = await s3Utils.downloadFile({ bucket: bucketName, key: fileName });
    return JSON.parse(fileContent.toString());
  } catch (error) {
    console.error(`Error getting conversion bundle for patient ${patientId}: ${error}`);
    return undefined;
  }
}

export async function getAllConversionBundleJobIds(
  cxId: string,
  patientId: string
): Promise<string[]> {
  const s3Utils = new S3Utils(Config.getAWSRegion());
  const bucketName = Config.getPharmacyConversionBucketName();
  if (!bucketName) {
    return [];
  }
  const files = await s3Utils.listObjects(
    bucketName,
    `surescripts/cxId=${cxId}/ptId=${patientId}/`
  );
  return files.flatMap(file => {
    if (!file.Key) return [];
    console.log(file.Key);
    const jobIdMatch = file.Key.match(/jobId=([\w\-_\d]{10})/);
    return jobIdMatch ? [jobIdMatch[1]] : [];
  });
}

export async function mergeConversionBundles(
  cxId: string,
  patientId: string
): Promise<Bundle | undefined> {
  const s3Utils = new S3Utils(Config.getAWSRegion());
  const fileName = buildLatestConversionBundleFileName(cxId, patientId);
  const bucketName = Config.getPharmacyConversionBucketName();
  if (!bucketName) {
    return undefined;
  }
  try {
    const fileContent = await s3Utils.downloadFile({ bucket: bucketName, key: fileName });
    return JSON.parse(fileContent.toString());
  } catch (error) {
    console.error(`Error getting conversion bundle for patient ${patientId}: ${error}`);
    return undefined;
  }
}

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

export async function writeLatestConversionBundle(
  cxId: string,
  patientId: string,
  bundle: Bundle
): Promise<void> {
  const s3Utils = new S3Utils(Config.getAWSRegion());
  const fileName = buildLatestConversionBundleFileName(cxId, patientId);
  const bucketName = Config.getPharmacyConversionBucketName();
  if (!bucketName) throw new Error("Pharmacy conversion bucket name not found");

  await s3Utils.uploadFile({
    bucket: bucketName,
    key: fileName,
    file: Buffer.from(JSON.stringify(bundle)),
    contentType: "application/json",
  });
}
export function openPreviewUrl(url: string): void {
  execSync(`open https://preview.metriport.com/?url=${encodeURIComponent(url)}`);
}

export function dangerouslyMergeBundles(
  cxId: string,
  patientId: string,
  baseBundle: Bundle,
  conversionBundle: Bundle
): Bundle {
  baseBundle.entry = [...(baseBundle.entry ?? []), ...(conversionBundle.entry ?? [])];
  dangerouslyDeduplicateFhir(baseBundle, cxId, patientId);
  return baseBundle;
}

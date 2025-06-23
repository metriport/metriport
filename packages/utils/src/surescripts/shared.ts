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

interface PatientTransmission {
  cxId: string;
  patientId: string;
  transmissionId: string;
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
  const s3Utils = new S3Utils("us-west-1");
  const medicalDocsBucketName = getEnvVarOrFail("MEDICAL_DOCUMENTS_BUCKET_NAME");

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
  const s3Utils = new S3Utils("us-west-1");
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
  const s3Utils = new S3Utils("us-west-1");
  const bucketName = getEnvVarOrFail("MEDICAL_DOCUMENTS_BUCKET_NAME");

  const fileName = createConsolidatedDataFileNameWithSuffix(cxId, patientId) + "-preview.json";
  const fileContent = JSON.stringify(bundle);
  await s3Utils.uploadFile({
    bucket: bucketName,
    key: fileName,
    file: Buffer.from(fileContent),
    contentType: "application/json",
  });
  return await s3Utils.getSignedUrl({
    bucketName,
    fileName,
    durationSeconds: 60 * 30,
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

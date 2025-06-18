import { executeWithNetworkRetries, MetriportError } from "@metriport/shared";
import { Bundle } from "@medplum/fhirtypes";
import { parseResponseFile } from "./file/file-parser";
import { ParsedResponseFile, ResponseDetail } from "./schema/response";
import { IncomingData } from "./schema/shared";
import { SurescriptsConversionBundle } from "./types";
import {
  buildLatestConversionBundleFileName,
  buildConversionBundleFileNameForJob,
} from "./file/file-names";
import { S3Utils } from "../aws/s3";
import { Config } from "../../util/config";
import { convertIncomingDataToFhirBundle } from "./fhir/bundle";

export async function convertPatientResponseToFhirBundle(
  cxId: string,
  responseFileContent: Buffer
): Promise<SurescriptsConversionBundle | undefined> {
  const responseFile = parseResponseFile(responseFileContent);
  const patientIdDetails = buildPatientIdToDetailsMap(responseFile);
  const patientIds = Array.from(patientIdDetails.keys());
  if (patientIds.length > 1) {
    throw new MetriportError("Expected exactly one patient in the response file", undefined, {
      patientIds: Array.from(patientIdDetails.keys()).join(", "),
    });
  }

  const patientId = patientIds[0];
  if (!patientId) return undefined;
  const details = patientIdDetails.get(patientId);
  if (!details || details.length < 1) return undefined;

  const bundle = await convertIncomingDataToFhirBundle(cxId, patientId, details);
  return {
    cxId,
    patientId,
    bundle,
  };
}

export async function convertBatchResponseToFhirBundles(
  cxId: string,
  responseFileContent: Buffer
): Promise<SurescriptsConversionBundle[]> {
  const responseFile = parseResponseFile(responseFileContent);
  const patientIdDetails = buildPatientIdToDetailsMap(responseFile);
  const conversionBundles: SurescriptsConversionBundle[] = [];
  for (const [patientId, details] of patientIdDetails.entries()) {
    if (!details || details.length < 1) continue;
    const bundle = await convertIncomingDataToFhirBundle(cxId, patientId, details);
    conversionBundles.push({
      cxId,
      patientId,
      bundle,
    });
  }
  return conversionBundles;
}

export async function uploadConversionBundle({
  bundle,
  cxId,
  patientId,
  jobId,
}: {
  bundle: Bundle;
  cxId: string;
  patientId: string;
  jobId: string;
}): Promise<void> {
  const latestBundleName = buildLatestConversionBundleFileName(cxId, patientId);
  const conversionBundleName = buildConversionBundleFileNameForJob({
    cxId,
    patientId,
    jobId,
  });
  const conversionBucket = new S3Utils(Config.getAWSRegion());
  const fileContent = Buffer.from(JSON.stringify(bundle));
  await executeWithNetworkRetries(async () => {
    await Promise.all([
      conversionBucket.uploadFile({
        bucket: Config.getPharmacyConversionBucketName(),
        key: latestBundleName,
        file: fileContent,
      }),
      conversionBucket.uploadFile({
        bucket: Config.getPharmacyConversionBucketName(),
        key: conversionBundleName,
        file: fileContent,
      }),
    ]);
  });
}

function buildPatientIdToDetailsMap(
  responseFile: ParsedResponseFile
): Map<string, IncomingData<ResponseDetail>[]> {
  const patientIdDetails = new Map<string, IncomingData<ResponseDetail>[]>();
  for (const detail of responseFile.details) {
    const patientId = detail.data.patientId;
    if (!patientIdDetails.has(patientId)) {
      patientIdDetails.set(patientId, []);
    }
    patientIdDetails.get(patientId)?.push(detail);
  }
  return patientIdDetails;
}

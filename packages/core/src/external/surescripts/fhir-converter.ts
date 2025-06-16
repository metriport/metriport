import { BadRequestError } from "@metriport/shared";
import { Bundle } from "@medplum/fhirtypes";
import { parseResponseFile } from "./file/file-parser";
import { ParsedResponseFile, ResponseDetail } from "./schema/response";
import { IncomingData } from "./schema/shared";
import { SurescriptsConversionBundle } from "./types";
import { makeConversionBundleFileName } from "./file/file-names";
import { S3Utils } from "../aws/s3";
import { Config } from "../../util/config";
import { convertIncomingDataToFhirBundle } from "./fhir/bundle";

export async function convertPatientResponseToFhirBundle(
  responseFileContent: Buffer
): Promise<SurescriptsConversionBundle | undefined> {
  const responseFile = parseResponseFile(responseFileContent);
  const patientIdDetails = buildPatientIdToDetailsMap(responseFile);
  if (patientIdDetails.size > 1) {
    throw new BadRequestError("Expected exactly one patient in the response file", undefined, {
      patientIds: Array.from(patientIdDetails.keys()).join(", "),
    });
  }

  for (const [patientId, details] of patientIdDetails.entries()) {
    const bundle = await convertIncomingDataToFhirBundle(patientId, details);
    return {
      patientId,
      bundle,
    };
  }
  return undefined;
}

export async function convertBatchResponseToFhirBundles(
  responseFileContent: Buffer
): Promise<SurescriptsConversionBundle[]> {
  const responseFile = parseResponseFile(responseFileContent);
  const patientIdDetails = buildPatientIdToDetailsMap(responseFile);

  const conversionBundles: SurescriptsConversionBundle[] = [];
  for (const [patientId, detailRows] of patientIdDetails.entries()) {
    const bundle = await convertIncomingDataToFhirBundle(patientId, detailRows);
    conversionBundles.push({
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
}: {
  bundle: Bundle;
  cxId: string;
  patientId: string;
}): Promise<void> {
  const fileName = makeConversionBundleFileName(cxId, patientId);
  const conversionBucket = new S3Utils(Config.getAWSRegion());
  await conversionBucket.uploadFile({
    bucket: Config.getPharmacyConversionBucketName(),
    key: fileName,
    file: Buffer.from(JSON.stringify(bundle)),
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

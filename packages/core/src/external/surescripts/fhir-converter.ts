import { MetriportError } from "@metriport/shared";
import { convertIncomingDataToFhirBundle } from "./fhir/bundle";
import { parseResponseFile } from "./file/file-parser";
import { ParsedResponseFile, ResponseDetail } from "./schema/response";
import { IncomingData } from "./schema/shared";
import { SurescriptsConversionBundle } from "./types";

export async function convertPatientResponseToFhirBundle(
  cxId: string,
  responseFileContent: Buffer
): Promise<SurescriptsConversionBundle | undefined> {
  if (responseFileContent.toString().startsWith('<?xml version="1.0" encoding="UTF-8"?>')) {
    console.log("Response file is XML! Skipping conversion.");
    return undefined;
  }
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

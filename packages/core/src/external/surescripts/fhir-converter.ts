import { BadRequestError } from "@metriport/shared";
import { Bundle, BundleEntry, Resource } from "@medplum/fhirtypes";
import { ParsedResponseFile, ResponseDetail } from "./schema/response";
import { IncomingData } from "./schema/shared";

import { getMedication } from "./fhir/medication";
import { getMedicationDispense } from "./fhir/medication-dispense";
import { getMedicationRequest } from "./fhir/medication-request";
import { getPrescriber } from "./fhir/prescriber";
import { getPharmacy } from "./fhir/pharmacy";
import { getPatient } from "./fhir/patient";
import { getCondition } from "./fhir/condition";

export async function convertPatientResponseToFhirBundle(
  responseFile: ParsedResponseFile
): Promise<Bundle | undefined> {
  const patientIdDetails = buildPatientIdToDetailsMap(responseFile);
  const patientIds = Array.from(patientIdDetails.keys());
  if (patientIds.length > 1) {
    throw new BadRequestError("Expected exactly one patient in the response file", undefined, {
      patientIds: patientIds.join(", "),
    });
  }

  const firstPatientId = patientIds[0];
  if (!firstPatientId) {
    return undefined;
  }
  const firstPatientDetails = patientIdDetails.get(firstPatientId);
  if (!firstPatientDetails) return undefined;
  return await convertPatientDetailsToFhirBundle(firstPatientId, firstPatientDetails);
}

export async function convertBatchResponseToFhirBundles(
  responseFile: ParsedResponseFile
): Promise<Bundle[]> {
  const patientIdDetails = buildPatientIdToDetailsMap(responseFile);

  const bundles: Bundle[] = [];
  for (const [patientId, detailRows] of patientIdDetails.entries()) {
    const fhirBundle = await convertPatientDetailsToFhirBundle(patientId, detailRows);
    bundles.push(fhirBundle);
  }
  return bundles;
}

// function patientIdToDetailMap(responseFile: ParsedResponseFile): Map<string, ResponseDetail[]> {
//   const patientIdToRows = new Map<string, ResponseDetail[]>();
//   for (const row of responseFile.detail) {
//     const patientId = row.patientId;
//     patientIdToRows.set(patientId, [...(patientIdToRows.get(patientId) ?? []), row]);
//   }
// }

async function convertPatientDetailsToFhirBundle(
  id: string,
  details: IncomingData<ResponseDetail>[]
): Promise<Bundle> {
  const bundle: Bundle = {
    resourceType: "Bundle",
    total: 0,
    type: "collection",
    entry: [],
  };

  for (const detail of details) {
    const entries = convertPatientDetailToEntries(detail.data);
    bundle.entry?.push(...entries);
    bundle.total = (bundle.total ?? 0) + entries.length;
  }

  return bundle;
}

export function convertPatientDetailToEntries(detail: ResponseDetail): BundleEntry<Resource>[] {
  const patient = getPatient(detail);
  const practitioner = getPrescriber(detail);
  const pharmacy = getPharmacy(detail);

  const condition = getCondition(detail);
  const medication = getMedication(detail);
  const medicationDispense = getMedicationDispense(detail);
  const medicationRequest = getMedicationRequest(detail);

  return [
    patient,
    practitioner,
    pharmacy,
    condition,
    medication,
    medicationDispense,
    medicationRequest,
  ].flatMap(function (resource): BundleEntry<Resource>[] {
    if (!resource) return [];
    return [{ resource }];
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

import { BadRequestError } from "@metriport/shared";
import { uuidv7 } from "@metriport/shared/util/uuid-v7";

import {
  Bundle,
  BundleEntry,
  Organization,
  Patient,
  Practitioner,
  Resource,
} from "@medplum/fhirtypes";
import { parseResponseFile } from "./file/file-parser";
import { ParsedResponseFile, ResponseDetail } from "./schema/response";
import { IncomingData } from "./schema/shared";
import { SurescriptsConversionBundle } from "./types";

import { getMedication } from "./fhir/medication";
import { getMedicationDispense } from "./fhir/medication-dispense";
import { getMedicationRequest } from "./fhir/medication-request";
import { getPrescriber } from "./fhir/prescriber";
import { getPharmacy } from "./fhir/pharmacy";
import { getPatient, mergePatient } from "./fhir/patient";
import { getCondition } from "./fhir/condition";

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
    const bundle = await convertPatientDetailsToFhirBundle(patientId, details);
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
    const bundle = await convertPatientDetailsToFhirBundle(patientId, detailRows);
    conversionBundles.push({
      patientId,
      bundle,
    });
  }
  return conversionBundles;
}

async function convertPatientDetailsToFhirBundle(
  patientId: string,
  details: IncomingData<ResponseDetail>[]
): Promise<Bundle> {
  const bundle: Bundle = {
    resourceType: "Bundle",
    total: 0,
    type: "collection",
    entry: [],
  };

  const sharedReferences = buildSharedReferences(patientId);
  for (const detail of details) {
    const entries = convertPatientDetailToEntries(detail.data, sharedReferences);
    bundle.entry?.push(...entries);
    bundle.total = (bundle.total ?? 0) + entries.length;
  }

  return bundle;
}

export function convertPatientDetailToEntries(
  detail: ResponseDetail,
  shared: SurescriptsSharedReferences
): BundleEntry<Resource>[] {
  const patient = mergePatient(shared.patient, getPatient(detail));
  const practitioner = deduplicateBySystemIdentifier(shared.practitioner, getPrescriber(detail));
  const pharmacy = deduplicateBySystemIdentifier(shared.pharmacy, getPharmacy(detail));
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
    if (!resource.id) resource.id = uuidv7();
    return [
      {
        fullUrl: "urn:uuid:" + resource.id,
        resource,
      },
    ];
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

interface SurescriptsSharedReferences {
  patient: Patient;
  // identifier system -> identifier value -> resource
  practitioner: SystemIdentifierMap<Practitioner>;
  pharmacy: SystemIdentifierMap<Organization>;
}

type SystemIdentifierMap<R extends Resource> = Record<string, IdentifierMap<R>>;
type IdentifierMap<R extends Resource> = Record<string, R>;

function buildSharedReferences(patientId: string): SurescriptsSharedReferences {
  const sharedReferences: SurescriptsSharedReferences = {
    patient: {
      resourceType: "Patient",
      id: patientId,
    },
    practitioner: {},
    pharmacy: {},
  };
  return sharedReferences;
}

function deduplicateBySystemIdentifier<R extends Practitioner | Organization>(
  systemMap: SystemIdentifierMap<R>,
  resource?: R
): R | undefined {
  if (!resource || !resource.identifier) return undefined;

  for (const identifier of resource.identifier) {
    if (!identifier.value || !identifier.system) continue;
    let identifierMap = systemMap[identifier.system];
    if (!identifierMap) {
      systemMap[identifier.system] = identifierMap = {};
    }
    const existingResource = identifierMap[identifier.value];
    if (existingResource) {
      return existingResource;
    }
    identifierMap[identifier.value] = resource;
  }
  return undefined;
}

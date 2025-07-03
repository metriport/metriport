import { MedplumClient } from "@medplum/core";
import {
  AllergyIntolerance,
  Binary,
  Bundle,
  Condition,
  DocumentReference,
  Encounter,
  Location,
  Practitioner,
  Resource,
} from "@medplum/fhirtypes";
import { Cohort, Facility, MetriportMedicalApi, PatientDTO } from "@metriport/api-sdk";
import { PatientWithId } from "@metriport/core/external/fhir/__tests__/patient";
import { getCxIdFromApiKey } from "../../../routes/middlewares/auth";
import { baseURL, testApiKey } from "../shared";

export const ACCOUNT_PATH = "/internal/admin/cx-account";
export const CUSTOMER_PATH = "/internal/customer";
export const MAPI_ACCESS = "/internal/mapi-access";

export const fhirHeaders = { headers: { "x-api-key": testApiKey } };
export const cxId = getCxIdFromApiKey(testApiKey);
export const fhirApi = new MedplumClient({ baseUrl: baseURL });
export const medicalApi = new MetriportMedicalApi(testApiKey, { baseAddress: baseURL });

export type ConsolidatedE2eContext = {
  bundle: Bundle<Resource>;
  allergyIntolerance: AllergyIntolerance;
  condition: Condition;
  encounter: Encounter;
  location: Location;
  practitioner: Practitioner;
};

export type ContributedE2eContext = {
  bundle: Bundle<Resource>;
  allergyIntolerance: AllergyIntolerance;
  condition: Condition;
  encounter: Encounter;
  location: Location;
  practitioner: Practitioner;
  documentReference: DocumentReference;
  binary: Binary;
};

export type E2eContext = {
  facility?: Facility | undefined;
  cohort?: Cohort | undefined;
  patient?: PatientDTO | undefined;
  patientFhir?: PatientWithId | undefined;
  consolidated?: ConsolidatedE2eContext | undefined;
  contributed?: ContributedE2eContext | undefined;
  url?: string | undefined;
  mrContentBuffer?: Buffer | undefined;
  expectedWebhookMeta?: Record<string, string> | undefined;
  putConsolidatedDataRequestId?: string | undefined;
};

export function getAllergyIdOrFail(e2e: E2eContext): string {
  const allergyId = e2e.consolidated?.allergyIntolerance?.id;
  if (!allergyId) throw new Error("Missing allergyIntolerance.id");
  return allergyId;
}

export function getConditionIdOrFail(e2e: E2eContext): string {
  const conditionId = e2e.consolidated?.condition?.id;
  if (!conditionId) throw new Error("Missing condition.id");
  return conditionId;
}

export function getEncounterIdOrFail(e2e: E2eContext): string {
  const encounterId = e2e.consolidated?.encounter?.id;
  if (!encounterId) throw new Error("Missing encounter.id");
  return encounterId;
}

export function getLocationIdOrFail(e2e: E2eContext): string {
  const locationId = e2e.consolidated?.location?.id;
  if (!locationId) throw new Error("Missing location.id");
  return locationId;
}

export function getPractitionerIdOrFail(e2e: E2eContext): string {
  const practitionerId = e2e.consolidated?.practitioner?.id;
  if (!practitionerId) throw new Error("Missing practitioner.id");
  return practitionerId;
}

export function getPatientLastNameOrFail(e2e: E2eContext): string {
  const lastName = e2e.patient?.lastName;
  if (!lastName) throw new Error("Missing patient.lastName");
  return lastName;
}

export function getDocumentReferenceIdOrFail(e2e: E2eContext): string {
  const documentId = e2e.contributed?.documentReference?.id;
  if (!documentId) throw new Error("Missing contributed.documentReference.id");
  return documentId;
}

export function getBinaryIdOrFail(e2e: E2eContext): string {
  const binaryId = e2e.contributed?.binary?.id;
  if (!binaryId) throw new Error("Missing contributed.binary");
  return binaryId;
}

export function getPutConsolidatedDataRequestIdOrFail(e2e: E2eContext): string {
  const requestId = e2e.putConsolidatedDataRequestId;
  if (!requestId) throw new Error("Missing putConsolidatedDataRequestId");
  return requestId;
}

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
import { Facility, MetriportMedicalApi, PatientDTO } from "@metriport/api-sdk";
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

export type E2eContext = {
  facility?: Facility | undefined;
  patient?: PatientDTO | undefined;
  patientFhir?: PatientWithId | undefined;
  consolidatedPayload?: Bundle<Resource> | undefined;
  allergyIntolerance?: AllergyIntolerance | undefined;
  condition?: Condition | undefined;
  encounter?: Encounter | undefined;
  location?: Location;
  practitioner?: Practitioner;
  documentReference?: DocumentReference | undefined;
  binary?: Binary | undefined;
  url?: string | undefined;
  mrContentBuffer?: Buffer | undefined;
  expectedWebhookMeta?: Record<string, string> | undefined;
  putConsolidatedDataRequestId?: string | undefined;
};

export function getAllergyIdOrFail(e2e: E2eContext): string {
  const allergyId = e2e.allergyIntolerance?.id;
  if (!allergyId) throw new Error("Missing allergyIntolerance.id");
  return allergyId;
}

export function getConditionIdOrFail(e2e: E2eContext): string {
  const conditionId = e2e.condition?.id;
  if (!conditionId) throw new Error("Missing condition.id");
  return conditionId;
}

export function getEncounterIdOrFail(e2e: E2eContext): string {
  const encounterId = e2e.encounter?.id;
  if (!encounterId) throw new Error("Missing encounter.id");
  return encounterId;
}

export function getLocationIdOrFail(e2e: E2eContext): string {
  const locationId = e2e.location?.id;
  if (!locationId) throw new Error("Missing location.id");
  return locationId;
}

export function getPractitionerIdOrFail(e2e: E2eContext): string {
  const practitionerId = e2e.practitioner?.id;
  if (!practitionerId) throw new Error("Missing practitioner.id");
  return practitionerId;
}

export function getPatientLastNameOrFail(e2e: E2eContext): string {
  const lastName = e2e.patient?.lastName;
  if (!lastName) throw new Error("Missing patient.lastName");
  return lastName;
}

export function getDocumentReferenceIdOrFail(e2e: E2eContext): string {
  const documentId = e2e.documentReference?.id;
  if (!documentId) throw new Error("Missing documentReference.id");
  return documentId;
}

export function getBinaryIdOrFail(e2e: E2eContext): string {
  const binaryId = e2e.binary?.id;
  if (!binaryId) throw new Error("Missing binary");
  return binaryId;
}

export function getPutConsolidatedDataRequestIdOrFail(e2e: E2eContext): string {
  const requestId = e2e.putConsolidatedDataRequestId;
  if (!requestId) throw new Error("Missing putConsolidatedDataRequestId");
  return requestId;
}

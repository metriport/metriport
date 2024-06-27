import { MedplumClient } from "@medplum/core";
import {
  AllergyIntolerance,
  Binary,
  Bundle,
  DocumentReference,
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
  documentReference?: DocumentReference | undefined;
  binary?: Binary | undefined;
  url?: string | undefined;
  mrContentBuffer?: Buffer | undefined;
  expectedWebhookMeta?: Record<string, string> | undefined;
  putConsolidatedDataRequestId?: string | undefined;
};

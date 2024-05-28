import { MedplumClient } from "@medplum/core";
import { MetriportMedicalApi } from "@metriport/api-sdk";
import { baseURL, testApiKey } from "../shared";

export const ACCOUNT_PATH = "/internal/admin/cx-account";
export const CUSTOMER_PATH = "/internal/customer";
export const MAPI_ACCESS = "/internal/mapi-access";

export const fhirHeaders = { headers: { "x-api-key": testApiKey } };

export const fhirApi = new MedplumClient({ baseUrl: baseURL });
export const medicalApi = new MetriportMedicalApi(testApiKey, { baseAddress: baseURL });

import { MetriportMedicalApi } from "@metriport/api-sdk";
import { FhirClient } from "@metriport/core/external/fhir/api/api";
import { baseURL } from "../shared";
import { getEnvVarOrFail } from "../../../shared/config";
import { MedplumClient } from "@medplum/core";

export const ACCOUNT_PATH = "/internal/admin/cx-account";
export const CUSTOMER_PATH = "/internal/customer";
export const MAPI_ACCESS = "/internal/mapi-access";

export const testApiKey = getEnvVarOrFail("TEST_API_KEY");
export const fhirHeaders = { headers: { "x-api-key": testApiKey } };

export const fhirApi = new MedplumClient({ baseUrl: baseURL });
export const medicalApi = new MetriportMedicalApi(testApiKey, { baseAddress: baseURL });

export type Apis = {
  medicalApi: MetriportMedicalApi;
  fhirApi: FhirClient;
};

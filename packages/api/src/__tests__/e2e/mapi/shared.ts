import { MedplumClient } from "@medplum/core";
import { MetriportMedicalApi } from "@metriport/api-sdk";
import { getEnvVarOrFail } from "../../../shared/config";
import { baseURL } from "../shared";

export const ACCOUNT_PATH = "/internal/admin/cx-account";
export const CUSTOMER_PATH = "/internal/customer";
export const MAPI_ACCESS = "/internal/mapi-access";

// TODO 1634 To be used when we're ready to add additional tests checking updates on HIEs
// export const testCxId = getEnvVarOrFail("TEST_CX_ID");

export const testApiKey = getEnvVarOrFail("TEST_API_KEY");
export const fhirHeaders = { headers: { "x-api-key": testApiKey } };

export const fhirApi = new MedplumClient({ baseUrl: baseURL });
export const medicalApi = new MetriportMedicalApi(testApiKey, { baseAddress: baseURL });

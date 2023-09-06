import { MetriportMedicalApi } from "@metriport/api-sdk";
import { FhirClient } from "../../../../../external/fhir/api/api";
import { baseURL } from "../../../../__tests__/shared";
import { Util } from "../../../../../shared/util";
import { getEnvVarOrFail } from "../../../../../shared/config";
import { MedplumClient } from "@medplum/core";

export const ACCOUNT_PATH = "/internal/admin/cx-account";
export const CUSTOMER_PATH = "/internal/customer";
export const MAPI_ACCESS = "/internal/mapi-access";

export const testId = getEnvVarOrFail("TEST_ACC_ID");
export const testApiKey = getEnvVarOrFail("TEST_API_KEY");
export const fhirHeaders = { headers: { "x-api-key": testApiKey } };

export const fhirApi = new MedplumClient({ baseUrl: baseURL });
export const medicalApi = new MetriportMedicalApi(testApiKey, { baseAddress: baseURL });

export enum ResourceType {
  Organization = "Organization",
  Patient = "Patient",
  DocumentReference = "DocumentReference",
}

export type Apis = {
  medicalApi: MetriportMedicalApi;
  fhirApi: FhirClient;
};

export const retryFunction = async <K>(
  fn: () => Promise<K>,
  maxRetries = 3,
  testFn?: (result: K) => boolean
) => {
  let count = 0;
  let retry = true;
  let result;

  while (retry) {
    count++;
    result = await fn();
    if (testFn && testFn(result)) break;
    if (!testFn && result) break;
    retry = count < maxRetries;
    await Util.sleep(3000);
  }

  return result;
};

import { MetriportMedicalApi } from "@metriport/api-sdk";
import { AxiosInstance } from "axios";
import { FhirClient } from "../../../../../external/fhir/api/api";
import { apiCognito, api as apiOSS, baseURL, apiInternal } from "../../../../__tests__/shared";
import { makeFhirApi } from "../../../../../external/fhir/api/api-factory";
import { testAccount, Account } from "./account";
import { Util } from "../../../../../shared/util";
import { getEnvVarOrFail } from "../../../../../shared/config";

export const ACCOUNT_PATH = "/internal/admin/cx-account";
export const CUSTOMER_PATH = "/internal/customer";
export const MAPI_ACCESS = "/internal/mapi-access";
const GENERATE_KEY = "/generateKey";

export type Apis = {
  apiOSS: AxiosInstance;
  medicalApi: MetriportMedicalApi;
  fhirApi: FhirClient;
};

export type E2ETest = {
  apis: Apis;
  account: Account;
};

export const setupE2ETest = async (isCreatingAccount?: boolean): Promise<E2ETest> => {
  if (isCreatingAccount) {
    const account = await apiInternal.post(ACCOUNT_PATH, testAccount);
    const apiKey = await apiCognito.post(GENERATE_KEY, null, {
      headers: {
        Authorization: account.data.idToken,
      },
    });
    apiOSS.defaults.headers["x-api-key"] = apiKey.data.key;

    const medicalApi = new MetriportMedicalApi(apiKey.data.key, { baseAddress: baseURL });
    const fhirApi = makeFhirApi(account.data.customer.id);

    await apiOSS.post(`${MAPI_ACCESS}?cxId=${account.data.customer.id}`);

    return {
      apis: {
        apiOSS,
        medicalApi,
        fhirApi,
      },
      account: account.data,
    };
  }

  const testId = getEnvVarOrFail("TEST_ACC_ID");
  const testApiKey = getEnvVarOrFail("TEST_API_KEY");

  const fhirApi = makeFhirApi(testId);
  apiOSS.defaults.headers["x-api-key"] = testApiKey;
  const medicalApi = new MetriportMedicalApi(testApiKey, { baseAddress: baseURL });
  const customerResp = await apiInternal.get(`${ACCOUNT_PATH}?cxId=${testId}`);

  return {
    apis: {
      apiOSS,
      medicalApi,
      fhirApi,
    },
    account: {
      customer: customerResp.data,
    },
  };
};

export const cleanUpE2ETest = async (
  apis: Apis,
  account: Account,
  isCreatingAccount?: boolean
): Promise<void> => {
  if (isCreatingAccount) {
    await apis.apiOSS.delete(`${MAPI_ACCESS}?cxId=${account.customer.id}`);
    await apiInternal.delete(`${ACCOUNT_PATH}?cxId=${account.customer.id}`, {
      headers: {
        Authorization: account.accessToken,
      },
    });
  }
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

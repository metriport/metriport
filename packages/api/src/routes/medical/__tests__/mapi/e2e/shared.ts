import { MetriportMedicalApi } from "@metriport/api-sdk";
import { AxiosInstance } from "axios";
import { FhirClient } from "../../../../../external/fhir/api/api";
import { api, baseURL, stagingBaseUrl, internalBaseURL } from "../../../../__tests__/shared";
import { makeFhirApi } from "../../../../../external/fhir/api/api-factory";
import { testAccount, Account } from "./account";

export const ACCOUNT_PATH = "/internal/admin/cx-account";
const GENERATE_KEY = "/generateKey";
export const MAPI_ACCESS = "/internal/mapi-access";

export const stagingApi = api(stagingBaseUrl);
export const internalApi = api(internalBaseURL);

export type Apis = {
  ossApi: AxiosInstance;
  medicalApi: MetriportMedicalApi;
  fhirApi: FhirClient;
};

export type E2ETest = {
  apis: Apis;
  account: Account;
};

export const setupE2ETest = async (isDummy?: boolean): Promise<E2ETest> => {
  if (!isDummy) {
    const account = await internalApi.post(ACCOUNT_PATH, testAccount);
    const apiKey = await stagingApi.post(GENERATE_KEY, null, {
      headers: {
        Authorization: account.data.idToken,
      },
    });
    const ossApi = api(baseURL, apiKey.data.key);
    const medicalApi = new MetriportMedicalApi(apiKey.data.key, { baseAddress: baseURL });
    const fhirApi = makeFhirApi(account.data.customer.id);

    await ossApi.post(`${MAPI_ACCESS}?cxId=${account.data.customer.id}`);

    return {
      apis: {
        ossApi,
        medicalApi,
        fhirApi,
      },
      account: account.data,
    };
  }

  // DUMMY ACCOUNT
  const dummyId = "77e32785-f463-4b3d-a6c0-78c66c51252d";
  const dummyApiKey =
    "Y1VRSllfTTE2TWdEbGFsdThzQmZiOjc3ZTMyNzg1LWY0NjMtNGIzZC1hNmMwLTc4YzY2YzUxMjUyZA";

  const fhirApi = makeFhirApi(dummyId);
  const ossApi = api(baseURL, dummyApiKey);
  const medicalApi = new MetriportMedicalApi(dummyApiKey, { baseAddress: baseURL });

  return {
    apis: {
      ossApi,
      medicalApi,
      fhirApi,
    },
    account: {
      accessToken: "",
      idToken: "",
      customer: {
        id: dummyId,
        firstName: "Test",
        lastName: "Customer",
        email: "",
        website: "",
        stripeCxId: null,
        subscriptionStatus: "active",
      },
    },
  };
};

export const cleanUpE2ETest = async (
  apis: Apis,
  account: Account,
  isDummy?: boolean
): Promise<void> => {
  if (isDummy) return;
  await apis.ossApi.delete(`${MAPI_ACCESS}?cxId=${account.customer.id}`);
  await internalApi.delete(`${ACCOUNT_PATH}?cxId=${account.customer.id}`, {
    headers: {
      Authorization: account.accessToken,
    },
  });
};

export const retryFunction = async (
  fn: () => Promise<unknown>,
  maxRetries = 3,
  match?: { key: string; value: string }
) => {
  let count = 0;
  let retry = true;
  //eslint-disable-next-line @typescript-eslint/no-explicit-any
  let result: any;

  while (retry) {
    count++;
    result = await fn();
    if (match && result[match.key] === match.value) break;
    if (!match && result) break;
    retry = count < maxRetries;
  }

  return result;
};

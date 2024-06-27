import axios, { AxiosHeaders, AxiosResponse } from "axios";
jest.mock("axios");

export function mockAxios() {
  const mockedAxios = jest.mocked(axios);
  return {
    axios: mockedAxios.mockImplementation(),
    get: mockedAxios.get.mockImplementation(),
    post: mockedAxios.post.mockImplementation(),
    put: mockedAxios.put.mockImplementation(),
    delete: mockedAxios.delete.mockImplementation(),
  };
}

export function makeAxiosResponse({
  method,
  status,
  data,
  statusText,
  headers,
  config,
}: { method?: AxiosResponse["config"]["method"] } & Partial<
  Pick<AxiosResponse, "status" | "data" | "statusText" | "headers" | "config">
>): AxiosResponse {
  return {
    status: status ?? 200,
    data: data ?? {},
    statusText: statusText ?? "OK",
    headers: headers ?? {},
    config: config ?? {
      headers: new AxiosHeaders(),
      method: method ?? "get",
    },
  };
}

export const errorWithCauseAxiosError = {
  errorType: "Error",
  errorMessage: "CW - Error downloading document",
  cause: {
    errorType: "Error",
    errorMessage: "Error retrieve document",
    cause: {
      message: "connect ETIMEDOUT 107.21.162.233:443",
      name: "Error",
      stack: "Error: connect ETIMEDOUT 107.21.162.233:443...",
      code: "ETIMEDOUT",
      status: null,
      isAxiosError: true,
    },
    additionalInfo: {
      headers: {
        Authorization: "Bearer ...",
      },
      inputUrl: "https://rest.api.commonwellalliance.org/v2/Binary/xxxxxx",
      outputStream: "[object]",
    },
    stack: [
      "Error: Error retrieve document",
      "    at Object.retrieve (/opt/nodejs/node_modules/@metriport/commonwell-sdk/dist/client/document.js:64:15)",
      "    at process.processTicksAndRejections (node:internal/process/task_queues:95:5)",
      "    at async executeWithRetries (/opt/nodejs/node_modules/@metriport/shared/dist/common/retry.js:46:28)",
      "    at async DocumentDownloaderLocal.downloadDocumentFromCW (/opt/nodejs/node_modules/@metriport/core/dist/external/commonwell/document/document-downloader-local.js:225:13)",
      "    at async DocumentDownloaderLocal.downloadFromCommonwellIntoS3 (/opt/nodejs/node_modules/@metriport/core/dist/external/commonwell/document/document-downloader-local.js:188:9)",
      "    at async executeWithRetries (/opt/nodejs/node_modules/@metriport/shared/dist/common/retry.js:46:28)",
      "    at async DocumentDownloaderLocal.download (/opt/nodejs/node_modules/@metriport/core/dist/external/commonwell/document/document-downloader-local.js:58:30)",
      "    at async /var/task/document-downloader.js:79:20",
      "    at async Runtime.handler (/opt/nodejs/node_modules/@sentry/serverless/cjs/awslambda.js:280:12)",
    ],
  },
  additionalInfo: {
    documentLocation: "https://rest.api.commonwellalliance.org/v2/Binary/xxxxxx",
    details:
      "Error retrieve document ({ headers: { Authorization: 'Bearer ...' }, inputUrl: 'https://rest.api.commonwellalliance.org/v2/Binary/xxxxxx', outputStream: '[object]' }); caused by connect ETIMEDOUT 107.21.162.233:443 (ETIMEDOUT); caused by connect ETIMEDOUT 107.21.162.233:443 (ETIMEDOUT)",
  },
  status: 500,
  stack: [
    "Error: CW - Error downloading document",
    "    at DocumentDownloaderLocal.downloadDocumentFromCW (/opt/nodejs/node_modules/@metriport/core/dist/external/commonwell/document/document-downloader-local.js:244:19)",
    "    at process.processTicksAndRejections (node:internal/process/task_queues:95:5)",
    "    at async DocumentDownloaderLocal.downloadFromCommonwellIntoS3 (/opt/nodejs/node_modules/@metriport/core/dist/external/commonwell/document/document-downloader-local.js:188:9)",
    "    at async executeWithRetries (/opt/nodejs/node_modules/@metriport/shared/dist/common/retry.js:46:28)",
    "    at async DocumentDownloaderLocal.download (/opt/nodejs/node_modules/@metriport/core/dist/external/commonwell/document/document-downloader-local.js:58:30)",
    "    at async /var/task/document-downloader.js:79:20",
    "    at async Runtime.handler (/opt/nodejs/node_modules/@sentry/serverless/cjs/awslambda.js:280:12)",
  ],
};

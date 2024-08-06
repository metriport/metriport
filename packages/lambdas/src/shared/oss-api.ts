import { executeWithNetworkRetries, InternalSendConsolidated } from "@metriport/shared";
import axios from "axios";
import { Log } from "./log";

const MAX_API_NOTIFICATION_ATTEMPTS = 5;

const ossApi = axios.create();

export type NotificationParams = {
  cxId: string;
  patientId: string;
  status: "success" | "failed";
  details?: string;
  jobId?: string;
  source?: string;
};

export function apiClient(apiURL: string) {
  const docProgressURL = `${apiURL}/internal/docs/conversion-status`;

  return {
    notifyApi: async function (params: NotificationParams, log: Log) {
      log(`Notifying API on ${docProgressURL} w/ ${JSON.stringify(params)}`);
      await executeWithNetworkRetries(() => ossApi.post(docProgressURL, null, { params }), {
        retryOnTimeout: true,
        maxAttempts: MAX_API_NOTIFICATION_ATTEMPTS,
      });
    },
    postConsolidated: postConsolidated(apiURL),
  };
}

function postConsolidated(apiURL: string) {
  return async function ({
    patientId,
    bundleLocation,
    bundleFilename,
    requestId,
    conversionType,
    resources,
    dateFrom,
    dateTo,
  }: InternalSendConsolidated & { patientId: string }) {
    const postConsolidated = `${apiURL}/internal/patient/${patientId}/consolidated`;
    await executeWithNetworkRetries(
      () =>
        ossApi.post(postConsolidated, {
          bundleLocation,
          bundleFilename,
          requestId,
          conversionType,
          resources,
          dateFrom,
          dateTo,
        }),
      {
        retryOnTimeout: false,
        maxAttempts: MAX_API_NOTIFICATION_ATTEMPTS,
      }
    );
  };
}

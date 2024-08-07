import { executeWithNetworkRetries } from "@metriport/shared";
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
  };
}

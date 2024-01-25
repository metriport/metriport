import axios from "axios";
import { capture } from "./capture";
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
      let attempt = 0;
      while (attempt++ < MAX_API_NOTIFICATION_ATTEMPTS) {
        try {
          log(`(${attempt}) Notifying API on ${docProgressURL} w/ ${JSON.stringify(params)}`);
          await ossApi.post(docProgressURL, null, { params });
          return;
          //eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (error: any) {
          const msg = "Error notifying API, trying again";
          const extra = {
            url: docProgressURL,
            statusCode: error.response?.status,
            attempt,
            error,
          };
          log(msg, extra);
          capture.message(msg, { extra, level: "info" });
        }
      }
      throw new Error(`Too many errors from API`);
    },
  };
}

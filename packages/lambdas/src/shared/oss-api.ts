import { CreateFeedback } from "@metriport/shared";
import { executeWithNetworkRetries } from "@metriport/shared";
import axios, { AxiosResponse } from "axios";
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

  function getCreateFeedbackUrl(id: string): string {
    return `${apiURL}/internal/feedback/${id}`;
  }
  function getRetrieveFeedbackUrl(id: string): string {
    return `${apiURL}/feedback/${id}`;
  }

  async function notifyApi(params: NotificationParams, log: Log) {
    log(`Notifying API on ${docProgressURL} w/ ${JSON.stringify(params)}`);
    await executeWithNetworkRetries(() => ossApi.post(docProgressURL, null, { params }), {
      retryOnTimeout: true,
      maxAttempts: MAX_API_NOTIFICATION_ATTEMPTS,
    });
  }

  async function createFeedback(params: CreateFeedback & { id: string }): Promise<AxiosResponse> {
    const url = getCreateFeedbackUrl(params.id);
    return await ossApi.put(url, params);
  }

  return {
    /** @deprecated: use internal.notifyApi() instead */
    notifyApi,
    internal: {
      notifyApi,
      createFeedback,
    },
    getRetrieveFeedbackUrl,
  };
}

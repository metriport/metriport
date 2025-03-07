import { CreateFeedback, executeWithNetworkRetries } from "@metriport/shared";
import axios, { AxiosResponse } from "axios";
import { Log } from "./log";

const MAX_API_NOTIFICATION_ATTEMPTS = 5;

const ossApi = axios.create();

export type NotificationParams = {
  cxId: string;
  patientId: string;
  status: "success" | "failed";
  details?: string | undefined;
  jobId: string | undefined;
  /** The MedicalDataSource, or HIE name */
  source?: string;
};

export type SyncPatientParams = {
  ehrId: string;
  ehrPracticeId: string;
  ehrPatientId: string;
};

type OssApiClient = {
  internal: {
    notifyApi(params: NotificationParams, log: Log): Promise<void>;
    ehrSyncPatient(params: SyncPatientParams, log: Log): Promise<AxiosResponse>;
    createFeedback(params: CreateFeedback & { id: string }): Promise<AxiosResponse>;
  };
};

export function apiClient(apiURL: string): OssApiClient {
  const docProgressURL = `${apiURL}/internal/docs/conversion-status`;

  function getCreateFeedbackUrl(id: string): string {
    return `${apiURL}/internal/feedback/${id}`;
  }

  function getSyncPatientUrl(ehrId: string, ehrPatientId: string, ehrPracticeId: string): string {
    return `${apiURL}/internal/ehr/${ehrId}/patient/${ehrPatientId}?practiceId=${ehrPracticeId}`;
  }

  async function notifyApi(params: NotificationParams, log: Log): Promise<void> {
    log(`Notifying API on ${docProgressURL} w/ ${JSON.stringify(params)}`);
    await executeWithNetworkRetries(() => ossApi.post(docProgressURL, null, { params }), {
      retryOnTimeout: true,
      maxAttempts: MAX_API_NOTIFICATION_ATTEMPTS,
    });
  }

  async function ehrSyncPatient(params: SyncPatientParams): Promise<AxiosResponse> {
    const url = getSyncPatientUrl(params.ehrId, params.ehrPatientId, params.ehrPracticeId);
    return await executeWithNetworkRetries(() => ossApi.get(url), {
      retryOnTimeout: true,
      maxAttempts: MAX_API_NOTIFICATION_ATTEMPTS,
    });
  }

  async function createFeedback(params: CreateFeedback & { id: string }): Promise<AxiosResponse> {
    const url = getCreateFeedbackUrl(params.id);
    return await ossApi.put(url, params);
  }

  return {
    internal: {
      notifyApi,
      ehrSyncPatient,
      createFeedback,
    },
  };
}

import { CreateFeedback } from "@metriport/shared";
import axios, { AxiosResponse } from "axios";

const ossApi = axios.create();

type OssApiClient = {
  internal: {
    createFeedback(params: CreateFeedback & { id: string }): Promise<AxiosResponse>;
  };
};

export function apiClient(apiURL: string): OssApiClient {
  function getCreateFeedbackUrl(id: string): string {
    return `${apiURL}/internal/feedback/${id}`;
  }

  async function createFeedback(params: CreateFeedback & { id: string }): Promise<AxiosResponse> {
    const url = getCreateFeedbackUrl(params.id);
    return await ossApi.put(url, params);
  }

  return {
    internal: {
      createFeedback,
    },
  };
}

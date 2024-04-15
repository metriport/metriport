import { DocumentQuery } from "@metriport/api-sdk";
import axios, { AxiosInstance } from "axios";
import { disableWHMetadata, TriggerAndQueryDocRefs } from "./trigger-and-query";

/**
 * Implementation of TriggerAndQueryDocRefs that calls the API to execute the logic
 * of each of its functions.
 */
export class TriggerAndQueryDocRefsRemote extends TriggerAndQueryDocRefs {
  readonly api: AxiosInstance;

  constructor(apiUrl: string) {
    super();
    this.api = axios.create({ baseURL: apiUrl });
  }

  protected override async triggerDocQuery(
    cxId: string,
    patientId: string,
    triggerWHNotifs: boolean
  ): Promise<void> {
    const payload = triggerWHNotifs ? {} : { metadata: disableWHMetadata };
    await this.api.post(`/internal/docs/query?cxId=${cxId}&patientId=${patientId}`, payload);
  }

  protected override async getDocQueryStatus(
    cxId: string,
    patientId: string
  ): Promise<DocumentQuery | undefined> {
    const resp = await this.api.get(`/internal/docs/query?cxId=${cxId}&patientId=${patientId}`);
    return resp.data.documentQueryProgress ?? undefined;
  }
}

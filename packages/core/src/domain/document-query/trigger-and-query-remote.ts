import { DocumentQuery } from "@metriport/api-sdk";
import axios from "axios";
import { TriggerAndQueryDocRefs, disableWHMetadata } from "./trigger-and-query";

/**
 * Implementation of TriggerAndQueryDocRefs that calls the API to execute the logic
 * of each of its functions.
 */
export class TriggerAndQueryDocRefsRemote extends TriggerAndQueryDocRefs {
  constructor(private readonly apiUrl: string) {
    super();
  }

  protected override async triggerDocQuery(
    cxId: string,
    patientId: string,
    triggerWHNotifs: boolean
  ): Promise<void> {
    const payload = triggerWHNotifs ? {} : { metadata: disableWHMetadata };
    await axios.post(
      `${this.apiUrl}/internal/docs/query?cxId=${cxId}&patientId=${patientId}`,
      payload
    );
  }

  protected override async getDocQueryStatus(
    cxId: string,
    patientId: string
  ): Promise<DocumentQuery | undefined> {
    const resp = await axios.get(
      `${this.apiUrl}/internal/docs/query?cxId=${cxId}&patientId=${patientId}`
    );
    return resp.data.documentQueryProgress ?? undefined;
  }
}

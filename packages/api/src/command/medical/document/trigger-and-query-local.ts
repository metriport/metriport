import { DocumentQuery } from "@metriport/api-sdk";
import {
  TriggerAndQueryDocRefs,
  disableWHMetadata,
} from "@metriport/core/domain/document-query/trigger-and-query";
import { getCurrentGlobalDocumentQueryProgress } from "../document-query";
import { queryDocumentsAcrossHIEs } from "./document-query";

/**
 * Implementation of TriggerAndQueryDocRefs that excutes the logic local.
 */
export class TriggerAndQueryDocRefsLocal extends TriggerAndQueryDocRefs {
  protected override async triggerDocQuery(
    cxId: string,
    patientId: string,
    triggerWHNotifs: boolean
  ): Promise<void> {
    const cxDocumentRequestMetadata = triggerWHNotifs ? {} : disableWHMetadata;
    await queryDocumentsAcrossHIEs({
      cxId,
      patientId,
      forceQuery: true,
      cxDocumentRequestMetadata,
    });
  }

  protected override async getDocQueryStatus(
    cxId: string,
    patientId: string
  ): Promise<DocumentQuery | undefined> {
    const docQueryProgress = await getCurrentGlobalDocumentQueryProgress({ cxId, patientId });
    return docQueryProgress;
  }
}

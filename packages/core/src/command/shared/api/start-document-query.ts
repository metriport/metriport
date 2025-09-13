import axios from "axios";
import { disableWHMetadata } from "../../../domain/document-query/trigger-and-query";
import { Config } from "../../../util/config";
import { withDefaultApiErrorHandling } from "./shared";

/**
 * Starts the document query for a patient.
 *
 * @param cxId - The customer ID.
 * @param patientId - The patient ID.
 * @param requestId - The data pipeline request ID.
 * @param disableWebhooks - Whether to disable webhooks.
 * @param triggerConsolidated - Whether to trigger consolidated to generate a PDF.
 * @param context - The context of the document query.
 */
export async function startDocumentQuery({
  cxId,
  patientId,
  requestId,
  triggerConsolidated,
  disableWebhooks,
  context,
}: {
  cxId: string;
  patientId: string;
  requestId: string;
  triggerConsolidated: boolean;
  disableWebhooks: boolean;
  context: string;
}): Promise<{ requestId: string }> {
  const api = axios.create({ baseURL: Config.getApiUrl() });
  const dqUrl = buildDocumentQueryUrl({ cxId, patientId, requestId, triggerConsolidated });
  const payload = disableWebhooks ? { metadata: disableWHMetadata } : {};

  const res = await withDefaultApiErrorHandling({
    functionToRun: () => api.post(dqUrl, payload),
    messageWhenItFails: `Failure while starting document query @ ${context}`,
    additionalInfo: {
      cxId,
      patientId,
      requestId,
      dqUrl,
      context: `${context}.startDocumentQuery`,
    },
  });

  return { requestId: res.data.requestId };
}

function buildDocumentQueryUrl({
  cxId,
  patientId,
  requestId,
  triggerConsolidated,
}: {
  cxId: string;
  patientId: string;
  requestId: string;
  triggerConsolidated: boolean;
}) {
  const urlParams = new URLSearchParams({
    cxId,
    patientId,
    requestId,
    triggerConsolidated: triggerConsolidated.toString(),
    forceQuery: "false",
  });
  return `/internal/docs/query?${urlParams.toString()}`;
}

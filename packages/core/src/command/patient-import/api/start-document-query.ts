import {
  defaultOptionsRequestNotAccepted,
  errorToString,
  executeWithNetworkRetries,
  MetriportError,
} from "@metriport/shared";
import axios from "axios";
import { disableWHMetadata } from "../../../domain/document-query/trigger-and-query";
import { Config } from "../../../util/config";
import { out } from "../../../util/log";

/**
 * Starts the document query for a patient.
 *
 * @param cxId - The customer ID.
 * @param patientId - The patient ID.
 * @param disableWebhooks - Whether to disable webhooks.
 * @param triggerConsolidated - Whether to trigger consolidated to generate a PDF.
 */
export async function startDocumentQuery({
  cxId,
  patientId,
  requestId,
  triggerConsolidated,
  disableWebhooks,
}: {
  cxId: string;
  patientId: string;
  requestId: string;
  triggerConsolidated: boolean;
  disableWebhooks: boolean;
}): Promise<void> {
  const { log } = out(`PatientImport startDocumentQuery - cxId ${cxId} patientId ${patientId}`);
  const api = axios.create({ baseURL: Config.getApiUrl() });
  const dqUrl = buildDocumentQueryUrl({ cxId, patientId, requestId, triggerConsolidated });
  const payload = disableWebhooks ? { metadata: disableWHMetadata } : {};
  try {
    await executeWithNetworkRetries(() => api.post(dqUrl, payload), {
      ...defaultOptionsRequestNotAccepted,
    });
  } catch (error) {
    const msg = `Failure while starting document query @ PatientImport`;
    log(`${msg}. Cause: ${errorToString(error)}`);
    throw new MetriportError(msg, error, {
      url: dqUrl,
      payload: JSON.stringify(payload),
      cxId,
      patientId,
      triggerConsolidated,
      disableWebhooks,
      context: "patient-import.startDocumentQuery",
    });
  }
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

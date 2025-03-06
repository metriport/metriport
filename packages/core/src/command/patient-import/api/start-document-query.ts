import { errorToString, MetriportError } from "@metriport/shared";
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
  triggerConsolidated,
  disableWebhooks,
}: {
  cxId: string;
  patientId: string;
  triggerConsolidated: boolean;
  disableWebhooks: boolean;
}): Promise<void> {
  const { log } = out(`PatientImport startDocumentQuery - cxId ${cxId} patientId ${patientId}`);
  const api = axios.create({ baseURL: Config.getApiUrl() });
  const dqUrl = buildDocumentQueryUrl(cxId, patientId, triggerConsolidated);
  const payload = disableWebhooks ? { metadata: disableWHMetadata } : {};
  try {
    await api.post(dqUrl, payload);
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

function buildDocumentQueryUrl(cxId: string, patientId: string, triggerConsolidated: boolean) {
  const urlParams = new URLSearchParams({
    cxId,
    patientId,
    triggerConsolidated: triggerConsolidated.toString(),
    forceQuery: "false",
  });
  return `/internal/docs/query?${urlParams.toString()}`;
}

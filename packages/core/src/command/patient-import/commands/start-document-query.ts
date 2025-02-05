import axios from "axios";
import { errorToString } from "@metriport/shared";
import { out } from "../../../util/log";
import { capture } from "../../../util/notifications";
import { Config } from "../../../util/config";

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
  const { log, debug } = out(
    `PatientImport startDocumentQuery - cxId ${cxId} patientId ${patientId}`
  );
  const api = axios.create({ baseURL: Config.getApiUrl() });
  const patientUrl = `/internal/docs/query?cxId=${cxId}&patientId=${patientId}&triggerConsolidated=${triggerConsolidated}&forceQuery=false`;
  try {
    const response = await api.post(
      patientUrl,
      disableWebhooks
        ? {
            metadata: {
              disableWHFlag: "true",
            },
          }
        : {}
    );
    if (!response.data) throw new Error(`No body returned from ${patientUrl}`);
    debug(`${patientUrl} resp: ${JSON.stringify(response.data)}`);
  } catch (error) {
    const msg = `Failure while starting document query @ PatientImport`;
    log(`${msg}. Cause: ${errorToString(error)}`);
    capture.error(msg, {
      extra: {
        url: patientUrl,
        cxId,
        patientId,
        context: "patient-import.start-document-query",
        error,
      },
    });
    throw error;
  }
}

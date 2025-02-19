import { errorToString, MetriportError } from "@metriport/shared";
import axios from "axios";
import { Config } from "../../../util/config";
import { out } from "../../../util/log";

// TODO 2330 add TSDoc
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
  const dqUrl = buildDocumentQueryUrl(cxId, patientId, triggerConsolidated);
  const payload = disableWebhooks ? { metadata: { disableWHFlag: "true" } } : {};
  try {
    const response = await api.post(dqUrl, payload);
    if (!response.data) throw new Error(`No body returned from ${dqUrl}`);
    debug(`${dqUrl} resp: ${JSON.stringify(response.data)}`);
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

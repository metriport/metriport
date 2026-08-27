import { createConsolidatedDataFilePath } from "@metriport/core/domain/consolidated/filename";
import { S3Utils } from "@metriport/core/external/aws/s3";
import { out } from "@metriport/core/util/log";
import { capture } from "@metriport/core/util/notifications";
import { errorToString } from "@metriport/shared";
import { NetworkSource, TerminalStatus } from "@metriport/shared/domain/network-query/source";
import { NetworkQueryWebhookPayload, NetworkQueryWebhookType } from "@metriport/shared/medical";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { Config } from "../../../shared/config";
import { getSettingsOrFail } from "../../settings/getSettings";
import { processRequest } from "../../webhook/webhook";
import { createWebhookRequest } from "../../webhook/webhook-request";
import { getPatientOrFail } from "../patient/get-patient";
import { NetworkQuery } from "./get-network-query";

dayjs.extend(duration);

const CONSOLIDATED_URL_DURATION = dayjs.duration({ hours: 4 });
const s3Utils = new S3Utils(Config.getAWSRegion());
const log = out("NetworkQueryWebhook").log;

export type NetworkQueryWebhookStatus = TerminalStatus;

export type ProcessNetworkQueryWebhookCmd = {
  networkQuery: NetworkQuery;
  source: NetworkSource;
  status: NetworkQueryWebhookStatus;
};

/**
 * Maps network source to webhook type.
 */
function toWebhookType(source: NetworkSource): NetworkQueryWebhookType {
  return `network-query.${source}` as NetworkQueryWebhookType;
}

/**
 * Sends a network query completion webhook to the customer.
 *
 * This function:
 * 1. Gets patient data (for externalId)
 * 2. Generates a presigned URL for the consolidated data
 * 3. Builds the webhook payload per the schema
 * 4. Creates and sends the webhook via existing infrastructure
 *
 * The specificSource is read from the stored DatasourceQueryEntry in the database,
 * where it was set when the source query was initiated (e.g., "surescripts", "quest").
 *
 * Callers are not notified of issues/errors while processing the request -
 * nothing is thrown. Instead, the error is logged and captured (Sentry).
 */
export async function processNetworkQueryWebhook({
  networkQuery,
  source,
  status,
}: ProcessNetworkQueryWebhookCmd): Promise<void> {
  const { cxId, patientId, requestId, datasources } = networkQuery;
  const { log: fnLog } = out(
    `processNetworkQueryWebhook - cxId ${cxId}, patientId ${patientId}, source ${source}`
  );

  try {
    const [settings, patient] = await Promise.all([
      getSettingsOrFail({ id: cxId }),
      getPatientOrFail({ id: patientId, cxId }),
    ]);

    const consolidatedDataUrl = await generateConsolidatedDataUrl({ cxId, patientId });

    const webhookType = toWebhookType(source);
    // Get the specificSource and completedAt from the stored DatasourceQueryEntry
    const sourceEntry = datasources.find(s => s.source === source);
    const specificSource = sourceEntry?.specificSource;
    const completedAt = sourceEntry?.completedAt ?? new Date();

    const payload: { payload: NetworkQueryWebhookPayload } = {
      payload: {
        patientId,
        ...(patient.externalId ? { externalId: patient.externalId } : {}),
        consolidatedDataUrl,
        source: {
          type: source,
          ...(specificSource ? { source: specificSource } : {}),
          status,
          completedAt: completedAt.toISOString(),
        },
      },
    };

    const webhookRequest = await createWebhookRequest({
      cxId,
      type: webhookType,
      payload,
      requestId,
    });

    const additionalWHRequestMeta: Record<string, string> = { requestId };
    const cxWHRequestMeta = sourceEntry?.data?.metadata;

    await processRequest(webhookRequest, settings, additionalWHRequestMeta, cxWHRequestMeta);

    fnLog(`Network query webhook sent successfully for source '${source}'`);
  } catch (err) {
    log(`Error on processNetworkQueryWebhook: ${errorToString(err)}`);
    capture.error(err, {
      extra: {
        cxId,
        patientId,
        requestId,
        source,
        context: "webhook.processNetworkQueryWebhook",
        err,
      },
    });
  }
}

/**
 * Generates a presigned URL for the consolidated data file.
 */
async function generateConsolidatedDataUrl({
  cxId,
  patientId,
}: {
  cxId: string;
  patientId: string;
}): Promise<string> {
  const bucketName = Config.getMedicalDocumentsBucketName();
  const fileName = createConsolidatedDataFilePath(cxId, patientId);

  return s3Utils.getSignedUrl({
    bucketName,
    fileName,
    durationSeconds: CONSOLIDATED_URL_DURATION.asSeconds(),
  });
}

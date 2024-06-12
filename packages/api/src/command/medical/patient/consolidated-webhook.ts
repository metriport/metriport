import { Resource } from "@medplum/fhirtypes";
import { Patient } from "@metriport/core/domain/patient";
import { ConsolidatedWebhookRequest, SearchSetBundle } from "@metriport/shared/medical";
import { errorToString } from "../../../shared/log";
import { capture } from "../../../shared/notifications";
import { Util } from "../../../shared/util";
import { getSettingsOrFail } from "../../settings/getSettings";
import { isWebhookDisabled, processRequest } from "../../webhook/webhook";
import { createWebhookRequest } from "../../webhook/webhook-request";
import { updateConsolidatedQueryProgress } from "./append-consolidated-query-progress";
import { getPatientOrFail } from "./get-patient";

const log = Util.log(`Consolidated Webhook`);

const consolidatedWebhookStatus = ["completed", "failed"] as const;
export type ConsolidatedWebhookStatus = (typeof consolidatedWebhookStatus)[number];

type Filters = Record<string, string | undefined>;

type PayloadWithoutMeta = Omit<ConsolidatedWebhookRequest, "meta">;

/**
 * Sends a FHIR bundle with a Patient's consolidated data to the customer's
 * webhook URL. The bundle and filters used to obtain it are optional so
 * we can send a failure notification.
 *
 * Callers are not notified of issues/errors while processing the request -
 * nothing is thrown. Instead, the error is logged and captured (Sentry).
 */
export async function processConsolidatedDataWebhook({
  patient,
  status,
  requestId,
  bundle,
  filters,
}: {
  patient: Pick<Patient, "id" | "cxId" | "externalId">;
  status: ConsolidatedWebhookStatus;
  requestId: string;
  bundle?: SearchSetBundle<Resource>;
  filters?: Filters;
}): Promise<void> {
  const { id: patientId, cxId, externalId } = patient;
  try {
    const [settings, currentPatient] = await Promise.all([
      getSettingsOrFail({ id: cxId }),
      getPatientOrFail({ id: patientId, cxId }),
    ]);
    // create a representation of this request and store on the DB
    const payload: PayloadWithoutMeta = {
      patients: [
        {
          patientId,
          ...(externalId ? { externalId } : {}),
          status,
          bundle,
          filters,
        },
      ],
    };

    // send it to the customer and update the WH request status
    if (!isWebhookDisabled(currentPatient.data.cxConsolidatedRequestMetadata)) {
      const webhookRequest = await createWebhookRequest({
        cxId,
        type: "medical.consolidated-data",
        payload,
        requestId,
      });

      const additionalWHRequestMeta: Record<string, string> = {};

      if (requestId) additionalWHRequestMeta.requestId = requestId;

      if (bundle) {
        additionalWHRequestMeta.bundleLength =
          optionalToString(bundle.entry?.length ?? bundle.total) ?? "unknown";
      }

      await processRequest(
        webhookRequest,
        settings,
        additionalWHRequestMeta,
        currentPatient.data.cxConsolidatedRequestMetadata
      );
    } else {
      await createWebhookRequest({
        cxId,
        type: "medical.consolidated-data",
        payload,
        status: "success",
        requestId,
      });
    }
    await updateConsolidatedQueryProgress({
      patient,
      requestId,
      progress: { status },
    });
  } catch (err) {
    log(`Error on processConsolidatedDataWebhook: ${errorToString(err)}`);
    capture.error(err, {
      extra: { patientId, context: `webhook.processConsolidatedDataWebhook`, err },
    });
    await updateConsolidatedQueryProgress({
      patient,
      requestId,
      progress: { status: "failed" },
    });
    throw err;
  }
}

const optionalToString = (
  v: string | number | boolean | object | undefined
): string | undefined => {
  return v ? v.toString() : undefined;
};

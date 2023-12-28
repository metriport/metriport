import { errorToString } from "@metriport/core/util/error";
import { capture } from "@metriport/core/util/notifications";
import { out } from "@metriport/core/util/log";
import { DocumentQueryProgress } from "../../../domain/medical/document-query";
import { Patient } from "../../../domain/medical/patient";
import { Product } from "../../../domain/product";
import { processPatientDocumentRequest } from "../document/document-webhook";
import { MAPIWebhookStatus } from "../document/document-webhook";
import { reportUsage as reportUsageCmd } from "../../usage/report-usage";

const { log } = out(`Doc Query Webhook`);

/**
 * Sends a list of document references resulting of a doc query to the customer's
 * webhook URL. The list of document references is optional so we can send a failure
 * notification.
 *
 * Callers are not notified of issues/errors while processing the request -
 * nothing is thrown. Instead, the error is logged and captured (Sentry).
 */
export const processDocQueryProgressWebhook = async ({
  patient,
  docQueryProgress,
}: {
  patient: Pick<Patient, "id" | "cxId" | "externalId">;
  docQueryProgress: DocumentQueryProgress;
}): Promise<void> => {
  const apiType = Product.medical;
  const { id: patientId, cxId } = patient;

  try {
    const downloadStatus = docQueryProgress.download?.status;
    const convertStatus = docQueryProgress.convert?.status;

    const downloadProgressNotProcessed = !convertStatus || convertStatus === "processing";

    if (downloadProgressNotProcessed) {
      if (downloadStatus === "failed") {
        processPatientDocumentRequest(
          patient.cxId,
          patient.id,
          "medical.document-download",
          MAPIWebhookStatus.failed
        );
      } else if (downloadStatus === "completed") {
        processPatientDocumentRequest(
          patient.cxId,
          patient.id,
          "medical.document-download",
          MAPIWebhookStatus.completed
        );
      }
    }

    if (convertStatus === "failed") {
      processPatientDocumentRequest(
        patient.cxId,
        patient.id,
        "medical.document-conversion",
        MAPIWebhookStatus.failed
      );
    } else if (convertStatus === "completed") {
      processPatientDocumentRequest(
        patient.cxId,
        patient.id,
        "medical.document-conversion",
        MAPIWebhookStatus.completed
      );
    }

    reportUsageCmd({ cxId, entityId: patientId, product: apiType, docQuery: true });
  } catch (err) {
    log(`Error on processDocQueryProgressWebhook: ${errorToString(err)}`);
    capture.error(err, {
      extra: { patientId, context: `webhook.processDocQueryProgressWebhook`, err },
    });
  }
};

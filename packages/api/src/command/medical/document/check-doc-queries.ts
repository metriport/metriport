import { Progress } from "@metriport/core/domain/document-query";
import { MedicalDataSource } from "@metriport/core/external/index";
import { executeAsynchronously } from "@metriport/core/util/concurrency";
import { out } from "@metriport/core/util/log";
import { capture } from "@metriport/core/util/notifications";
import stringify from "json-stringify-safe";
import { getDocumentQueryProgressesToUpdate, updateDocumentQueryProgress } from "../document-query";
import { recreateConsolidated } from "../patient/consolidated-recreate";
import { getPatientOrFail } from "../patient/get-patient";
import { sendWHNotifications } from "./check-doc-queries-notification";
import {
  GroupedValidationResult,
  PatientsWithValidationResult,
  ProgressType,
  Source,
} from "./check-doc-queries-shared";

const MAX_CONCURRENT_UDPATES = 10;

/**
 * Ops-driven function to check the status of all document queries in progress.
 * NOT TO BE USED BY CUSTOMERS DIRECTLY.
 *
 * For each patient with a document query in progress that match the criteria,
 * it will update the status to `completed` and trigger the webhook.
 *
 * @param patientIds - Optional list of patient IDs to check. If not provided, all patients will be checked.
 */
export async function checkDocumentQueries(patientIds: string[]): Promise<void> {
  const { log } = out(`checkDocumentQueries - patientIds ${patientIds.join(", ")}`);
  try {
    const patientsToUpdate: PatientsWithValidationResult = {};
    const docQueryProgressesToUpdate = await getDocumentQueryProgressesToUpdate(patientIds);
    for (const docQueryProgress of docQueryProgressesToUpdate) {
      const patientId = docQueryProgress.patientId;
      const requestId = docQueryProgress.requestId;
      const cxId = docQueryProgress.cxId;

      const progressesArgs: [Progress, Source, ProgressType][] = [
        [docQueryProgress.commonwell.download, "commonwell", "download"],
        [docQueryProgress.commonwell.convert, "commonwell", "convert"],
        [docQueryProgress.carequality.download, "carequality", "download"],
        [docQueryProgress.carequality.convert, "carequality", "convert"],
        [docQueryProgress.unknown.download, "unknown", "download"],
        [docQueryProgress.unknown.convert, "unknown", "convert"],
      ];

      for (const [progress, source, progressType] of progressesArgs) {
        if (progress.total !== calculateTotal(progress)) {
          patientsToUpdate[patientId] = {
            ...patientsToUpdate[patientId],
            [source]: {
              ...patientsToUpdate[patientId]?.[source],
              [progressType]: true,
            },
            requestId,
            cxId,
          };
        }
      }
    }

    await updateDocQueryStatus(patientsToUpdate);

    const updatedPatientIds = Object.keys(patientsToUpdate);
    const amount = updatedPatientIds.length;
    if (amount > 0) {
      const msg = "Fixed patients with unexpected doc query status";
      const extra = { amount, patientsToUpdate: updatedPatientIds.join(", ") };
      capture.message(msg, { extra, level: "warning" });
      log(msg, stringify(extra));
    } else {
      if (docQueryProgressesToUpdate.length > 0) {
        log("Got doc query progresses with invalid status from the DB, but no patients to update");
      }
    }

    sendWHNotifications(patientsToUpdate);

    log(`Done, ${amount} patients found and updated`);
  } catch (error) {
    const msg = "Error checking document queries";
    log(msg, String(error));
    capture.message(msg, { extra: { patientIds, error }, level: "error" });
  }
}

function calculateTotal(prop: Progress) {
  return (prop.errors ?? 0) + (prop.successful ?? 0);
}

export async function updateDocQueryStatus(patients: PatientsWithValidationResult): Promise<void> {
  const uniquePatients = Object.entries(patients);
  await executeAsynchronously(uniquePatients, async patient => updatePatientsInSequence(patient), {
    numberOfParallelExecutions: MAX_CONCURRENT_UDPATES,
  });
}

async function updatePatientsInSequence([patientId, { cxId, requestId, ...whatToUpdate }]: [
  string,
  GroupedValidationResult
]): Promise<void> {
  const patient = await getPatientOrFail({ id: patientId, cxId });
  if (whatToUpdate.commonwell?.download) {
    await updateDocumentQueryProgress({
      cxId,
      patientId,
      requestId,
      source: MedicalDataSource.COMMONWELL,
      progressType: "download",
    });
  }
  if (whatToUpdate.commonwell?.convert) {
    await updateDocumentQueryProgress({
      cxId,
      patientId,
      requestId,
      source: MedicalDataSource.COMMONWELL,
      progressType: "convert",
    });
  }
  if (whatToUpdate.carequality?.download) {
    await updateDocumentQueryProgress({
      cxId,
      patientId,
      requestId,
      source: MedicalDataSource.CAREQUALITY,
      progressType: "download",
    });
  }
  if (whatToUpdate.carequality?.convert) {
    await updateDocumentQueryProgress({
      cxId,
      patientId,
      requestId,
      source: MedicalDataSource.CAREQUALITY,
      progressType: "convert",
    });
  }
  if (whatToUpdate.unknown?.download) {
    await updateDocumentQueryProgress({
      cxId,
      patientId,
      requestId,
      source: "unknown",
      progressType: "download",
    });
  }
  if (whatToUpdate.unknown?.convert) {
    await updateDocumentQueryProgress({
      cxId,
      patientId,
      requestId,
      source: "unknown",
      progressType: "convert",
    });
  }
  // we want to await here to ensure the consolidated bundle is created before we send the webhook
  await recreateConsolidated({ patient, context: "check-queries" });
}

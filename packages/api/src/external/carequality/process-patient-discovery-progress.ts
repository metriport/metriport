import { errorToString } from "@metriport/shared/common/error";
import { capture } from "@metriport/core/util/notifications";
import { Patient } from "@metriport/core/domain/patient";
import { MedicalDataSource } from "@metriport/core/external/index";
import { out } from "@metriport/core/util/log";
import { getDocumentsFromCQ } from "./document/query-documents";
import { setDocQueryProgress } from "../hie/set-doc-query-progress";
import { resetPatientScheduledDocQueryRequestId } from "../hie/reset-scheduled-doc-query-request-id";
import { getCQData } from "./patient";
import { updatePatientDiscoveryStatus } from "./command/update-patient-discovery-status";

/**
 * Updates the patient discovery status for patient.
 * It also checks whether there's a scheduled document query and triggers it if so.
 */
export async function processPatientDiscoveryProgress({
  patient,
  status,
}: {
  patient: Pick<Patient, "id" | "cxId">;
  status: "processing" | "completed" | "failed";
}): Promise<void> {
  const { log } = out(`CQ Process PD Status - patient ${patient.id}`);

  try {
    const updatedPatient = await updatePatientDiscoveryStatus({ patient, status });

    const scheduledDocQueryRequestId = getCQData(
      updatedPatient.data.externalData
    )?.scheduledDocQueryRequestId;

    if (scheduledDocQueryRequestId) {
      if (status === "completed") {
        log(`Triggering scheduled document query with requestId ${scheduledDocQueryRequestId}`);

        getDocumentsFromCQ({ requestId: scheduledDocQueryRequestId, patient: updatedPatient });
      } else if (status === "failed") {
        await setDocQueryProgress({
          patient,
          requestId: scheduledDocQueryRequestId,
          source: MedicalDataSource.CAREQUALITY,
          downloadProgress: { status: "failed", total: 0 },
        });
      }

      const cleanUpScheduledDocQuery = status !== "processing";

      if (cleanUpScheduledDocQuery) {
        log(`Cleaning up scheduled document query`);
        await resetPatientScheduledDocQueryRequestId({
          patient: updatedPatient,
          source: MedicalDataSource.CAREQUALITY,
        });
      }
    }
  } catch (error) {
    const msg = `Error processing patient discovery progress`;
    log(`${msg} - ${errorToString(error)}`);
    capture.error(msg, {
      extra: {
        patient,
        status,
        error,
      },
    });
  }
}

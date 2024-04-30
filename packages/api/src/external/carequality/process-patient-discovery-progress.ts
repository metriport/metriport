import { errorToString } from "@metriport/shared/common/error";
import { capture } from "@metriport/core/util/notifications";
import { Patient } from "@metriport/core/domain/patient";
import { MedicalDataSource } from "@metriport/core/external/index";
import { out } from "@metriport/core/util/log";
import { getDocumentsFromCQ } from "./document/query-documents";
import { setDocQueryProgress } from "../hie/set-doc-query-progress";
import { resetPatientScheduledDocQueryRequestId } from "../hie/reset-scheduled-doc-query-request-id";
import { getCQData, discover } from "./patient";
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
  status: "processing" | "completed" | "failed" | "re-run";
}): Promise<void> {
  const { log } = out(`CQ Process PD Status - patient ${patient.id}`);

  try {
    const updatedPatient = await updatePatientDiscoveryStatus({ patient, status });

    if (status === "re-run") {
      const requestId = updatedPatient.data.patientDiscovery?.requestId;
      const facilityId = updatedPatient.facilityIds[0];
      if (!requestId || !facilityId) {
        log(
          `Cannot trigger re-run of patient discovery with missing requestId or facilityId - patient ${patient.id}`
        );
      } else {
        log(
          `Triggering re-run of patient discovery with requestId ${requestId} and facilityId ${facilityId}`
        );

        discover(updatedPatient, facilityId, requestId, true);
      }
      return;
    }

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
          convertProgress: { status: "failed", total: 0 },
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

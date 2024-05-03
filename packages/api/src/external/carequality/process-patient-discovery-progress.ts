import { errorToString } from "@metriport/shared/common/error";
import { capture } from "@metriport/core/util/notifications";
import { Patient } from "@metriport/core/domain/patient";
import { MedicalDataSource } from "@metriport/core/external/index";
import { out } from "@metriport/core/util/log";
import { getDocumentsFromCQ } from "./document/query-documents";
import { setDocQueryProgress } from "../hie/set-doc-query-progress";
import { resetPatientScheduledDocQueryRequestId } from "../hie/reset-scheduled-doc-query-request-id";
import { resetPatientScheduledPatientDiscoveryRequestId } from "../hie/reset-scheduled-patient-discovery-request-id";
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
  status: "processing" | "completed" | "failed";
}): Promise<void> {
  const { log } = out(`CQ Process PD Status - patient ${patient.id}`);

  try {
    const updatedPatient = await updatePatientDiscoveryStatus({ patient, status });

    const cqData = getCQData(updatedPatient.data.externalData);

    const scheduledDocQueryRequestId = cqData?.scheduledDocQueryRequestId;

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

    const facilityId = updatedPatient.data.patientDiscovery?.facilityId;
    const scheduledPdRequestId = cqData?.scheduledPdRequestId;

    if (facilityId && scheduledPdRequestId) {
      if (status === "completed") {
        log(`Triggering new patient discovery with requestId ${scheduledPdRequestId}`);

        await discover(updatedPatient, facilityId, scheduledPdRequestId);
      } else if (status === "failed") {
        // Skip next patient discvoery if current one failed
      }

      const cleanUpScheduledPd = status !== "processing";

      if (cleanUpScheduledPd) {
        log(`Cleaning up scheduled patient discovery`);
        await resetPatientScheduledPatientDiscoveryRequestId({
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

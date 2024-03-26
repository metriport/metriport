import { Patient } from "@metriport/core/domain/patient";
import { MedicalDataSource } from "@metriport/core/external/index";
import { out } from "@metriport/core/util/log";
import { getPatientOrFail } from "../../../command/medical/patient/get-patient";
import { PatientModel } from "../../../models/medical/patient";
import { executeOnDBTx } from "../../../models/transaction-wrapper";
import { getDocumentsFromCQ } from "../document/query-documents";
import { setDocQueryProgress } from "../../hie/set-doc-query-progress";
import { getCQData } from "../patient";

/**
 * Updates the patient discovery status for patient.
 * It also checks whether there's a scheduled document query and triggers it if so.
 */
export async function updatePatientDiscoveryStatus({
  patient,
  status,
}: {
  patient: Pick<Patient, "id" | "cxId">;
  status: "processing" | "completed" | "failed";
}): Promise<void> {
  const { log } = out(`CQ DQ - patient ${patient.id}`);

  const patientFilter = {
    id: patient.id,
    cxId: patient.cxId,
  };

  let docQueryRequestIdToTrigger: string | undefined = undefined;
  let newScheduledDocQueryRequestId: string | undefined = undefined;
  let patientDiscoverFailed = false;

  const updatedPatient = await executeOnDBTx(PatientModel.prototype, async transaction => {
    const existingPatient = await getPatientOrFail({
      ...patientFilter,
      lock: true,
      transaction,
    });

    const externalData = existingPatient.data.externalData ?? {};

    if (status === "completed") {
      docQueryRequestIdToTrigger = getCQData(externalData)?.scheduledDocQueryRequestId;
      newScheduledDocQueryRequestId = undefined;
    } else if (status === "failed") {
      newScheduledDocQueryRequestId = getCQData(externalData)?.scheduledDocQueryRequestId;
      patientDiscoverFailed = true;
    } else {
      newScheduledDocQueryRequestId = getCQData(externalData)?.scheduledDocQueryRequestId;
    }

    const updatePatientDiscoveryStatus = {
      ...externalData,
      CAREQUALITY: {
        ...externalData.CAREQUALITY,
        discoveryStatus: status,
        scheduledDocQueryRequestId: newScheduledDocQueryRequestId,
      },
    };

    const updatedPatient = {
      ...existingPatient.dataValues,
      data: {
        ...existingPatient.data,
        externalData: updatePatientDiscoveryStatus,
      },
    };

    await PatientModel.update(updatedPatient, {
      where: patientFilter,
      transaction,
    });

    return updatedPatient;
  });

  if (patientDiscoverFailed) {
    const scheduledDocQueryRequestId = getCQData(
      updatedPatient.data.externalData
    )?.scheduledDocQueryRequestId;

    if (scheduledDocQueryRequestId) {
      // TODO: define the data to be updated on the patient in setDocQueryProgress so we could call it here too.
      await setDocQueryProgress({
        patient,
        requestId: scheduledDocQueryRequestId,
        source: MedicalDataSource.CAREQUALITY,
        downloadProgress: { status: "failed", total: 0 },
      });
    }
  }

  if (docQueryRequestIdToTrigger) {
    log(`Triggering scheduled document query with requestId ${docQueryRequestIdToTrigger}`);
    getDocumentsFromCQ({ requestId: docQueryRequestIdToTrigger, patient: updatedPatient });
  }
}

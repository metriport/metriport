import { Patient } from "@metriport/core/domain/patient";
import { out } from "@metriport/core/util/log";
import { getPatientOrFail } from "../../../command/medical/patient/get-patient";
import { PatientModel } from "../../../models/medical/patient";
import { executeOnDBTx } from "../../../models/transaction-wrapper";
import { getDocumentsFromCQ } from "../document/query-documents";
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

  const updatedPatient = await executeOnDBTx(PatientModel.prototype, async transaction => {
    const existingPatient = await getPatientOrFail({
      ...patientFilter,
      lock: true,
      transaction,
    });

    const externalData = existingPatient.data.externalData ?? {};

    let newScheduledDocQueryRequestId: string | undefined = undefined;
    if (status === "completed") {
      docQueryRequestIdToTrigger = getCQData(externalData)?.scheduledDocQueryRequestId;
      newScheduledDocQueryRequestId = undefined;
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
      ...existingPatient,
      data: {
        ...existingPatient.data,
        externalData: updatePatientDiscoveryStatus,
      },
    };

    await PatientModel.update(updatedPatient, {
      where: patientFilter,
      transaction,
    });

    return updatedPatient.dataValues;
  });

  if (docQueryRequestIdToTrigger) {
    log(`Triggering scheduled document query with requestId ${docQueryRequestIdToTrigger}`);
    getDocumentsFromCQ({ requestId: docQueryRequestIdToTrigger, patient: updatedPatient });
  }
}

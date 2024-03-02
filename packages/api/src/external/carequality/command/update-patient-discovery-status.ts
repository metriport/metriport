import { Patient } from "@metriport/core/domain/patient";
import { PatientModel } from "../../../models/medical/patient";
import { executeOnDBTx } from "../../../models/transaction-wrapper";
import { getPatientOrFail } from "../../../command/medical/patient/get-patient";

/**
 * Updates the patient discovery status for patient
 *
 * @returns
 */
export async function updatePatientDiscoveryStatus({
  patient,
  status,
}: {
  patient: Pick<Patient, "id" | "cxId">;
  status: "processing" | "completed" | "failed";
}): Promise<void> {
  const patientFilter = {
    id: patient.id,
    cxId: patient.cxId,
  };

  await executeOnDBTx(PatientModel.prototype, async transaction => {
    const existingPatient = await getPatientOrFail({
      ...patientFilter,
      lock: true,
      transaction,
    });

    const externalData = existingPatient.data.externalData ?? {};

    const updatePatientDiscoveryStatus = {
      ...externalData,
      CAREQUALITY: { ...externalData.CAREQUALITY, discoveryStatus: status },
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
  });
}

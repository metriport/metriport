import { getPatientOrFail } from "../../../command/medical/patient/get-patient";
import { Patient } from "@metriport/core/domain/patient";
import { PatientModel } from "../../../models/medical/patient";
import { executeOnDBTx } from "../../../models/transaction-wrapper";

/**
 * Clears the CommonWell (CW) Person ID on the patient.
 *
 * @param patient The patient ID and customer ID @ Metriport.
 * @returns Updated Patient.
 */
export const clearPersonId = async ({
  patient,
}: {
  patient: Pick<Patient, "id" | "cxId">;
}): Promise<Patient> => {
  const patientFilter = {
    id: patient.id,
    cxId: patient.cxId,
  };

  return executeOnDBTx(PatientModel.prototype, async transaction => {
    const existingPatient = await getPatientOrFail({
      ...patientFilter,
      lock: true,
      transaction,
    });

    const externalData = existingPatient.data.externalData ?? {};

    const updateCWExternalData = {
      ...externalData,
      COMMONWELL: {
        ...externalData.COMMONWELL,
        personId: undefined,
      },
    };

    const updatedPatient = {
      ...existingPatient.dataValues,
      data: {
        ...existingPatient.data,
        externalData: updateCWExternalData,
      },
    };

    await PatientModel.update(updatedPatient, {
      where: patientFilter,
      transaction,
    });

    return updatedPatient;
  });
};

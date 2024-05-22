import { getPatientOrFail } from "../../../command/medical/patient/get-patient";
import { Patient } from "@metriport/core/domain/patient";
import { PatientModel } from "../../../models/medical/patient";
import { executeOnDBTx } from "../../../models/transaction-wrapper";

/**
 * Sets the CommonWell (CW) IDs on the patient.
 *
 * @param patient The patient ID and customer ID @ Metriport.
 * @param commonWellPatientId The patient ID @ CommonWell.
 * @param commonWellPersonId The person ID @ CommonWell.
 * @returns Updated Patient.
 */
export const updatePatientAndPersonIds = async ({
  patient,
  commonWellPatientId,
  commonWellPersonId,
}: {
  patient: Pick<Patient, "id" | "cxId">;
  commonWellPatientId?: string;
  commonWellPersonId?: string;
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
        ...(commonWellPatientId && { patientId: commonWellPatientId }),
        ...(commonWellPersonId && { personId: commonWellPersonId }),
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

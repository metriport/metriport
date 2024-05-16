import { getPatientOrFail } from "../../../command/medical/patient/get-patient";
import { Patient } from "@metriport/core/domain/patient";
import { PatientModel } from "../../../models/medical/patient";
import { executeOnDBTx } from "../../../models/transaction-wrapper";

/**
 * Sets the CQLink CommonWell (CW) integration status on the patient.
 *
 * @param patient The patient ID and customer ID @ Metriport.
 * @param cqLinkStatus The status of linking the patient with CareQuality orgs using CW's
 * @returns Updated Patient.
 */
export const clearCommenwellCqLinkStatus = async ({
  patient,
}: {
  patient: Pick<Patient, "id" | "cxId">;
}): Promise<Patient> => {
  const patientFilter = {
    id: patient.id,
    cxId: patient.cxId,
  };

  return await executeOnDBTx(PatientModel.prototype, async transaction => {
    const existingPatient = await getPatientOrFail({
      ...patientFilter,
      lock: true,
      transaction,
    });

    const externalData = existingPatient.data.externalData ?? {};

    const updateCqLinkStatus = {
      ...externalData,
      COMMONWELL: {
        ...externalData.COMMONWELL,
        cqLinkStatus: undefined,
      },
    };

    const updatedPatient = {
      ...existingPatient.dataValues,
      data: {
        ...existingPatient.data,
        externalData: updateCqLinkStatus,
      },
    };

    await PatientModel.update(updatedPatient, {
      where: patientFilter,
      transaction,
    });

    return updatedPatient;
  });
};

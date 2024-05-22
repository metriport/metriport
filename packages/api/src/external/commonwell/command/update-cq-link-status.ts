import { getPatientOrFail } from "../../../command/medical/patient/get-patient";
import { Patient } from "@metriport/core/domain/patient";
import { PatientModel } from "../../../models/medical/patient";
import { executeOnDBTx } from "../../../models/transaction-wrapper";
import { CQLinkStatus } from "../patient-shared";
import { getLinkStatusCQ } from "../patient";

/**
 * Sets the CommonWell (CW) CQLink integration status on the patient.
 *
 * @param patient The patient ID and customer ID @ Metriport.
 * @param cqLinkStatus The status of linking the patient with CareQuality orgs using CW's
 * @returns Updated Patient.
 */
export const updateCqLinkStatus = async ({
  patient,
  cqLinkStatus,
}: {
  patient: Pick<Patient, "id" | "cxId">;
  cqLinkStatus?: CQLinkStatus;
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

    const updatedCQLinkStatus = cqLinkStatus ?? getLinkStatusCQ(existingPatient.data.externalData);

    const externalData = existingPatient.data.externalData ?? {};

    const updateCqLinkStatus = {
      ...externalData,
      COMMONWELL: {
        ...externalData.COMMONWELL,
        cqLinkStatus: updatedCQLinkStatus,
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

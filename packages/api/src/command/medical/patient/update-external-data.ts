import { Patient, PatientExternalData } from "../../../domain/medical/patient";
import { validateVersionForUpdate } from "../../../models/_default";
import { PatientModel } from "../../../models/medical/patient";
import { executeOnDBTx } from "../../../models/transaction-wrapper";
import { BaseUpdateCmdWithCustomer } from "../base-update-command";
import { getPatientOrFail } from "./get-patient";

export type PatientExternalUpdateCmd = BaseUpdateCmdWithCustomer & PatientExternalData;

export const updateExternalData = async (
  patientUpdate: PatientExternalUpdateCmd
): Promise<Patient> => {
  const { id, cxId, eTag } = patientUpdate;

  return executeOnDBTx(PatientModel.prototype, async transaction => {
    const patient = await getPatientOrFail({
      id,
      cxId,
      lock: true,
      transaction,
    });

    validateVersionForUpdate(patient, eTag);

    return patient.update(
      {
        data: {
          ...patient.data,
          externalData: {
            COMMONWELL: {
              ...patient.data.externalData?.COMMONWELL,
            },
            CAREQUALITY: {
              ...patient.data.externalData?.CAREQUALITY,
              ...patientUpdate.CAREQUALITY,
            },
          },
        },
      },
      { transaction }
    );
  });
};

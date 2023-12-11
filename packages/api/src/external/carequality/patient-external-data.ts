import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { cloneDeep } from "lodash";
import { getPatientOrFail } from "../../command/medical/patient/get-patient";
import { Patient } from "../../domain/medical/patient";
import { PatientModel } from "../../models/medical/patient";
import { executeOnDBTx } from "../../models/transaction-wrapper";
import { PatientDataCarequality } from "./patient-shared";
import { getCQData } from "./patient";

dayjs.extend(duration);

export type PatientWithCQData = Patient & {
  data: { externalData: { CAREQUALITY: PatientDataCarequality } };
};

/**
 * Sets the Carequality (CQ) IDs on the patient.
 *
 * @param patientId The patient ID @ Metriport.
 * @param cxId The customer ID @ Metriport.
 * @param carequalityPatientId The patient ID @ cq gateway
 * @param carequalityPatientSystemId The system ID @ cq gateway
 * @returns
 */
export const setCarequalityId = async ({
  patientId,
  cxId,
  carequalityPatientId,
  carequalityPatientSystemId,
}: {
  patientId: string;
  cxId: string;
  carequalityPatientId: string;
  carequalityPatientSystemId: string;
}): Promise<Patient> => {
  return executeOnDBTx(PatientModel.prototype, async transaction => {
    const updatedPatient = await getPatientOrFail({
      id: patientId,
      cxId,
      lock: true,
      transaction,
    });

    // TODO: #1353 Optimize Sequelize updates
    const updatedData = cloneDeep(updatedPatient.data);

    const carequalityExternalData = getCQData(updatedData.externalData);

    const patientLinksHasSystemId = carequalityExternalData?.patientLinks?.some(
      patientLink => patientLink.systemId === carequalityPatientSystemId
    );

    if (patientLinksHasSystemId) {
      return updatedPatient;
    }

    updatedData.externalData = {
      ...updatedData.externalData,
      CAREQUALITY: {
        ...updatedData.externalData?.CAREQUALITY,
        patientLinks: [
          ...(carequalityExternalData?.patientLinks ?? []),
          {
            patientId: carequalityPatientId,
            systemId: carequalityPatientSystemId,
          },
        ],
      },
    };

    return updatedPatient.update({ data: updatedData }, { transaction });
  });
};

import { MedicalDataSource, isMedicalDataSource } from "@metriport/core/external/index";
import { BadRequestError } from "@metriport/shared";
import { PatientModel } from "../../../models/medical/patient";
import { getPatientModelOrFail } from "./get-patient";
import { executeOnDBTx } from "../../../models/transaction-wrapper";

export type ResetExternalData = {
  cxId: string;
  patientId: string;
  source: string;
};

export const resetExternalData = async ({
  cxId,
  patientId,
  source,
}: ResetExternalData): Promise<void> => {
  if (!isMedicalDataSource(source)) {
    throw new BadRequestError(
      `Invalid source. Must be one of: ${Object.values(MedicalDataSource).join(", ")}`
    );
  }

  await executeOnDBTx(PatientModel.prototype, async transaction => {
    const patient = await getPatientModelOrFail({ cxId, id: patientId, transaction, lock: true });
    const data = { ...patient.data };

    const updatedPatient = await patient.update(
      {
        data: {
          ...data,
          externalData: {
            ...data.externalData,
            [source]: undefined,
          },
        },
      },
      { transaction }
    );

    return updatedPatient;
  });
};

import { MedicalDataSource, isMedicalDataSource } from "@metriport/core/external/index";
import { BadRequestError } from "@metriport/shared";
import { PatientModel } from "../../../models/medical/patient";
import { getPatientModelOrFail } from "../patient/get-patient";
import { executeOnDBTx } from "../../../models/transaction-wrapper";

export type ResetExternalDataSource = {
  cxId: string;
  patientId: string;
  source: string;
};

/**
 * ADMIN ONLY: Resets external data for a specific source for a patient.
 * This function should only be used by administrators for maintenance purposes.
 */
export async function resetExternalDataSource({
  cxId,
  patientId,
  source,
}: ResetExternalDataSource): Promise<void> {
  if (!isMedicalDataSource(source)) {
    throw new BadRequestError(
      `Invalid source. Must be one of: ${Object.values(MedicalDataSource).join(", ")}`
    );
  }

  await executeOnDBTx(PatientModel.prototype, async transaction => {
    const patient = await getPatientModelOrFail({ cxId, id: patientId, transaction, lock: true });

    const updatedPatient = await patient.update(
      {
        data: {
          ...patient.data,
          externalData: {
            ...patient.data.externalData,
            [source]: undefined,
          },
        },
      },
      { transaction }
    );

    return updatedPatient;
  });
}

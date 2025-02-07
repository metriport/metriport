import { PatientExternalData } from "@metriport/core/domain//patient";
import { Patient } from "@metriport/core/domain/patient";
import { MedicalDataSource } from "@metriport/core/external/index";
import { getPatientModelOrFail } from "../../command/medical/patient/get-patient";
import { PatientModel } from "../../models/medical/patient";
import { executeOnDBTx } from "../../models/transaction-wrapper";

export type setDocQueryStartAt = {
  patient: Pick<Patient, "id" | "cxId">;
  source: MedicalDataSource;
  startedAt: Date;
};

/**
 * Set start time for document query progress
 *
 * @returns Updated patient
 */
export async function setDocQueryStartAt({
  patient,
  source,
  startedAt,
}: setDocQueryStartAt): Promise<Patient> {
  const patientFilter = {
    id: patient.id,
    cxId: patient.cxId,
  };

  const result = await executeOnDBTx(PatientModel.prototype, async transaction => {
    const existingPatient = await getPatientModelOrFail({
      ...patientFilter,
      lock: true,
      transaction,
    });

    const sourceData = existingPatient.data.externalData?.[source] ?? {};

    const externalData: PatientExternalData = {
      ...existingPatient.data.externalData,
      [source]: {
        ...sourceData,
        documentQueryProgress: {
          ...sourceData.documentQueryProgress,
          startedAt,
        },
      },
    };

    const updatedPatient = {
      ...existingPatient.dataValues,
      data: {
        ...existingPatient.data,
        externalData,
      },
    };

    await PatientModel.update(updatedPatient, {
      where: patientFilter,
      transaction,
    });

    return updatedPatient;
  });

  return result;
}

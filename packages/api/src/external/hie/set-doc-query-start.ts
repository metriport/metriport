import { MedicalDataSource } from "@metriport/core/external/index";
import { PatientExternalData } from "@metriport/core/domain//patient";
import { Patient } from "@metriport/core/domain/patient";
import { PatientModel } from "../../models/medical/patient";
import { executeOnDBTx } from "../../models/transaction-wrapper";
import { getPatientModelOrFail } from "../../command/medical/patient/get-patient";

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

  return executeOnDBTx(PatientModel.prototype, async transaction => {
    const existingPatient = await getPatientModelOrFail({
      ...patientFilter,
      lock: true,
      transaction,
    });

    const sourceData = existingPatient.dataValues.data.externalData?.[source] ?? {};

    const externalData: PatientExternalData = {
      ...existingPatient.dataValues.data.externalData,
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
        ...existingPatient.dataValues.data,
        externalData,
      },
    };

    await PatientModel.update(updatedPatient, {
      where: patientFilter,
      transaction,
    });

    return updatedPatient;
  });
}

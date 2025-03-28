import { PatientExternalData } from "@metriport/core/domain//patient";
import { Patient } from "@metriport/core/domain/patient";
import { MedicalDataSource } from "@metriport/core/external/index";
import { PatientModel } from "../../models/medical/patient";
import { executeOnDBTx } from "../../models/transaction-wrapper";
import { getPatientOrFail } from "../../command/medical/patient/get-patient";

export type setDocRetrieveStartAt = {
  patient: Pick<Patient, "id" | "cxId">;
  source: MedicalDataSource;
  startedAt: Date;
};

/**
 * Set start time for document query progress
 *
 * @returns Updated patient
 */
export async function setDocRetrieveStartAt({
  patient: { id, cxId },
  source,
  startedAt,
}: setDocRetrieveStartAt): Promise<Patient> {
  const patientFilter = { id, cxId };
  return executeOnDBTx(PatientModel.prototype, async transaction => {
    const patient = await getPatientOrFail({
      ...patientFilter,
      lock: true,
      transaction,
    });

    const sourceData = patient.data.externalData?.[source] ?? {};

    const externalData: PatientExternalData = {
      ...patient.data.externalData,
      [source]: {
        ...sourceData,
        documentRetrievalStartTime: startedAt,
      },
    };

    const updatedPatient = {
      ...patient,
      data: {
        ...patient.data,
        externalData,
      },
    };

    await PatientModel.update(updatedPatient, { where: patientFilter, transaction });

    return updatedPatient;
  });
}

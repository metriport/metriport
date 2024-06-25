import { PatientExternalData } from "@metriport/core/domain//patient";
import { Patient } from "@metriport/core/domain/patient";
import { PatientModel } from "../../models/medical/patient";
import { executeOnDBTx } from "../../models/transaction-wrapper";
import { getPatientOrFail } from "../../command/medical/patient/get-patient";
import { setDocQueryStartAt } from "./set-doc-query-start";

export type setDocRetrieveStartAt = setDocQueryStartAt;

/**
 * Set start time for document query progress
 *
 * @returns Updated patient
 */
export async function setDocRetrieveStartAt({
  patient,
  source,
  startedAt,
}: setDocRetrieveStartAt): Promise<Patient> {
  const patientFilter = {
    id: patient.id,
    cxId: patient.cxId,
  };

  const result = await executeOnDBTx(PatientModel.prototype, async transaction => {
    const existingPatient = await getPatientOrFail({
      ...patientFilter,
      lock: true,
      transaction,
    });

    const sourceData = existingPatient.data.externalData?.[source] ?? {};

    const externalData: PatientExternalData = {
      ...existingPatient.data.externalData,
      [source]: {
        ...sourceData,
        documentRetrievalStartTime: startedAt,
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

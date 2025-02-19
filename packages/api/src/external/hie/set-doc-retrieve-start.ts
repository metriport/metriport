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

    await PatientModel.update(updatedPatient, {
      where: patientFilter,
      transaction,
    });

    return updatedPatient;
  });
}

import { MedicalDataSource } from "@metriport/core/external/index";
import { getPatientOrFail } from "../../command/medical/patient/get-patient";
import { Patient } from "@metriport/core/domain/patient";
import { PatientModel } from "../../models/medical/patient";
import { executeOnDBTx } from "../../models/transaction-wrapper";

export async function resetPatientScheduledDocQueryRequestId({
  patient: { id, cxId },
  source,
}: {
  patient: Pick<Patient, "id" | "cxId">;
  source: MedicalDataSource;
}): Promise<Patient> {
  const patientFilter = { id, cxId };
  return executeOnDBTx(PatientModel.prototype, async transaction => {
    const patient = await getPatientOrFail({
      ...patientFilter,
      lock: true,
      transaction,
    });

    const externalData = patient.data.externalData ?? {};

    const updatedExternalData = {
      ...externalData,
      [source]: {
        ...externalData[source],
        scheduledDocQueryRequestId: undefined,
        scheduledDocQueryRequestTriggerConsolidated: undefined,
      },
    };

    const updatedPatient = {
      ...patient,
      data: {
        ...patient.data,
        externalData: updatedExternalData,
      },
    };

    await PatientModel.update(updatedPatient, { where: patientFilter, transaction });

    return updatedPatient;
  });
}

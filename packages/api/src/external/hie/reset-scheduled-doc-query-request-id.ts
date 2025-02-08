import { MedicalDataSource } from "@metriport/core/external/index";
import { getPatientModelOrFail } from "../../command/medical/patient/get-patient";
import { Patient } from "@metriport/core/domain/patient";
import { PatientModel } from "../../models/medical/patient";
import { executeOnDBTx } from "../../models/transaction-wrapper";

export async function resetPatientScheduledDocQueryRequestId({
  patient,
  source,
}: {
  patient: Pick<Patient, "id" | "cxId">;
  source: MedicalDataSource;
}): Promise<Patient> {
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

    const externalData = existingPatient.dataValues.data.externalData ?? {};

    const updatedExternalData = {
      ...externalData,
      [source]: {
        ...externalData[source],
        scheduledDocQueryRequestId: undefined,
        scheduledDocQueryRequestTriggerConsolidated: undefined,
      },
    };

    const updatedPatient = {
      ...existingPatient.dataValues,
      data: {
        ...existingPatient.dataValues.data,
        externalData: updatedExternalData,
      },
    };

    await PatientModel.update(updatedPatient, {
      where: patientFilter,
      transaction,
    });

    return updatedPatient;
  });
}

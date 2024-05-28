import { MedicalDataSource } from "@metriport/core/external/index";
import { getPatientOrFail } from "../../command/medical/patient/get-patient";
import { Patient } from "@metriport/core/domain/patient";
import { PatientModel } from "../../models/medical/patient";
import { executeOnDBTx } from "../../models/transaction-wrapper";

export async function resetPatientScheduledPatientDiscoveryRequestId({
  patient,
  source,
}: {
  patient: Patient;
  source: MedicalDataSource;
}): Promise<Patient> {
  const patientFilter = {
    id: patient.id,
    cxId: patient.cxId,
  };

  return await executeOnDBTx(PatientModel.prototype, async transaction => {
    const existingPatient = await getPatientOrFail({
      ...patientFilter,
      lock: true,
      transaction,
    });

    const externalData = existingPatient.data.externalData ?? {};

    const updatedExternalData = {
      ...externalData,
      [source]: {
        ...externalData[source],
        scheduledPdRequest: undefined,
      },
    };

    const updatedPatient = {
      ...existingPatient.dataValues,
      data: {
        ...existingPatient.data,
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

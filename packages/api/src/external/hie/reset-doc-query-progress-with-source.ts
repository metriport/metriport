import { MedicalDataSource } from "@metriport/core/external/index";
import { Patient } from "@metriport/core/domain/patient";
import { PatientModel } from "../../models/medical/patient";
import { executeOnDBTx } from "../../models/transaction-wrapper";
import { getPatientOrFail } from "../../command/medical/patient/get-patient";

/**
 * Reset the doc query progress for the given hie
 * @returns the updated patient
 */
export async function resetDocQueryProgressWithSource({
  patient,
  source,
}: {
  patient: Patient;
  source: MedicalDataSource;
}): Promise<void> {
  const patientFilter = {
    id: patient.id,
    cxId: patient.cxId,
  };

  await executeOnDBTx(PatientModel.prototype, async transaction => {
    const existingPatient = await getPatientOrFail({
      ...patientFilter,
      lock: true,
      transaction,
    });

    const externalData = existingPatient.data.externalData ?? {};

    const resetExternalData = { ...externalData };

    if (source === MedicalDataSource.COMMONWELL) {
      resetExternalData.COMMONWELL = {
        ...externalData.COMMONWELL,
        documentQueryProgress: {},
      };
    } else if (source === MedicalDataSource.CAREQUALITY) {
      resetExternalData.CAREQUALITY = {
        ...externalData.CAREQUALITY,
        documentQueryProgress: {},
      };
    } else {
      resetExternalData.COMMONWELL = {
        ...externalData.COMMONWELL,
        documentQueryProgress: {},
      };
      resetExternalData.CAREQUALITY = {
        ...externalData.CAREQUALITY,
        documentQueryProgress: {},
      };
    }

    existingPatient.data.externalData = resetExternalData;

    await PatientModel.update(existingPatient, {
      where: patientFilter,
      transaction,
    });
  });
}

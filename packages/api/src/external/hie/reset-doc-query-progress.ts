import { MedicalDataSource } from "@metriport/core/external/index";
import { Patient } from "@metriport/core/domain/patient";
import { PatientModel } from "../../models/medical/patient";
import { executeOnDBTx } from "../../models/transaction-wrapper";
import { getPatientOrFail } from "../../command/medical/patient/get-patient";

/**
 * Resets the doc query progress for the given HIE
 *
 * @returns
 */
export async function resetDocQueryProgress({
  patient,
  source,
}: {
  patient: Pick<Patient, "id" | "cxId">;
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

    const updatedPatient = {
      ...existingPatient,
      data: {
        ...existingPatient.data,
        externalData: resetExternalData,
      },
    };

    if (source === MedicalDataSource.ALL) {
      resetExternalData.COMMONWELL = {
        ...externalData.COMMONWELL,
        documentQueryProgress: {},
      };

      resetExternalData.CAREQUALITY = {
        ...externalData.CAREQUALITY,
        documentQueryProgress: {},
      };

      updatedPatient.data.documentQueryProgress = {};
    } else {
      resetExternalData[source] = {
        ...externalData[source],
        documentQueryProgress: {},
      };
    }

    await PatientModel.update(updatedPatient, {
      where: patientFilter,
      transaction,
    });
  });
}

export function buildInterrupt({
  patientId,
  cxId,
  source,
  log,
}: {
  patientId: string;
  cxId: string;
  source: MedicalDataSource;
  log: typeof console.log;
}) {
  return async (reason: string): Promise<void> => {
    log(reason + ", skipping DQ");
    await resetDocQueryProgress({
      patient: { id: patientId, cxId },
      source,
    });
  };
}

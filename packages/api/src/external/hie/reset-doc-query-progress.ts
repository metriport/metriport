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

    const updatedPatient = {
      ...existingPatient,
      data: {
        ...existingPatient.data,
        externalData: resetExternalData,
        documentQueryProgress: {},
      },
    };

    await PatientModel.update(updatedPatient, {
      where: patientFilter,
      transaction,
    });
  });
}

export function buildInterrupt({
  patientId,
  cxId,
  log,
}: {
  patientId: string;
  cxId: string;
  log: typeof console.log;
}) {
  return async (reason: string): Promise<void> => {
    log(reason + ", skipping DQ");
    await resetDocQueryProgress({
      patient: { id: patientId, cxId },
      source: MedicalDataSource.CAREQUALITY,
    });
  };
}

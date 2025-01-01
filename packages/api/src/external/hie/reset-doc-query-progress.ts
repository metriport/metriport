import { MedicalDataSource } from "@metriport/core/external/index";
import { Patient } from "@metriport/core/domain/patient";
import { PatientModel } from "../../models/medical/patient";
import { executeOnDBTx } from "../../models/transaction-wrapper";
import { getPatientOrFail } from "../../command/medical/patient/get-patient";
import { aggregateAndSetHIEProgresses } from "./set-doc-query-progress";
import { processDocQueryProgressWebhook } from "../../command/medical/document/process-doc-query-webhook";

/**
 * Resets the doc query progress for the given HIE
 *
 * @returns
 */
export async function resetDocQueryProgress({
  patient,
  source,
  requestId,
}: {
  patient: Pick<Patient, "id" | "cxId">;
  source: MedicalDataSource;
  requestId?: string;
}): Promise<void> {
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

    const externalData = existingPatient.data.externalData ?? {};

    const resetExternalData = { ...externalData };

    const updatedPatient = {
      ...existingPatient.dataValues,
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

      const existingPatientDocProgress = existingPatient.data.documentQueryProgress ?? {};

      const aggregatedDocProgresses = aggregateAndSetHIEProgresses(
        existingPatientDocProgress,
        resetExternalData
      );

      updatedPatient.data.documentQueryProgress = aggregatedDocProgresses;
    }

    await PatientModel.update(updatedPatient, {
      where: patientFilter,
      transaction,
    });

    return updatedPatient;
  });

  if (requestId && result.data.documentQueryProgress) {
    await processDocQueryProgressWebhook({
      patient: result,
      documentQueryProgress: result.data.documentQueryProgress,
      requestId,
    });
  }
}

export function buildInterrupt({
  patientId,
  cxId,
  source,
  requestId,
  log,
}: {
  patientId: string;
  cxId: string;
  source: MedicalDataSource;
  requestId: string;
  log: typeof console.log;
}) {
  return async (reason: string): Promise<void> => {
    log(reason + ", skipping DQ");
    await resetDocQueryProgress({
      patient: { id: patientId, cxId },
      requestId,
      source,
    });
  };
}

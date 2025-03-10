import { Patient } from "@metriport/core/domain/patient";
import { MedicalDataSource } from "@metriport/core/external/index";
import { processDataPipelineCheckpoints } from "../../command/medical/document/process-doc-query-webhook";
import { getPatientOrFail } from "../../command/medical/patient/get-patient";
import { PatientModel } from "../../models/medical/patient";
import { executeOnDBTx } from "../../models/transaction-wrapper";
import { aggregateAndSetHIEProgresses } from "./set-doc-query-progress";

/**
 * Resets the doc query progress for the given HIE
 *
 * @returns
 */
export async function resetDocQueryProgress({
  patient: { id, cxId },
  source,
  requestId,
}: {
  patient: Pick<Patient, "id" | "cxId">;
  source: MedicalDataSource;
  requestId?: string;
}): Promise<void> {
  const patientFilter = { id, cxId };
  const patient = await executeOnDBTx(PatientModel.prototype, async transaction => {
    const patient = await getPatientOrFail({
      ...patientFilter,
      lock: true,
      transaction,
    });

    const externalData = patient.data.externalData ?? {};

    const resetExternalData = { ...externalData };

    const updatedPatient = {
      ...patient,
      data: {
        ...patient.data,
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

      const existingPatientDocProgress = patient.data.documentQueryProgress ?? {};

      const aggregatedDocProgresses = aggregateAndSetHIEProgresses(
        existingPatientDocProgress,
        resetExternalData
      );

      updatedPatient.data.documentQueryProgress = aggregatedDocProgresses;
    }

    await PatientModel.update(updatedPatient, { where: patientFilter, transaction });

    return updatedPatient;
  });

  if (requestId && patient.data.documentQueryProgress) {
    await processDataPipelineCheckpoints({
      patient,
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

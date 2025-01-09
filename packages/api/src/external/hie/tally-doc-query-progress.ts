import { DocumentQueryProgress, Progress } from "@metriport/core/domain/document-query";
import { getStatusFromProgress } from "@metriport/core/domain/document-query";
import { MedicalDataSource } from "@metriport/core/external/index";
import { PatientExternalData } from "@metriport/core/domain//patient";
import { ProgressType } from "@metriport/core/domain/document-query";
import { Patient } from "@metriport/core/domain/patient";
import { PatientModel } from "../../models/medical/patient";
import { executeOnDBTx } from "../../models/transaction-wrapper";
import { getPatientOrFail } from "../../command/medical/patient/get-patient";
import { processDocQueryProgressWebhook } from "../../command/medical/document/process-doc-query-webhook";
import { getPatientDocProgressFromHies } from "./set-doc-query-progress";

type DynamicProgress = Pick<Progress, "successful" | "errors">;

export type TallyDocQueryProgress = {
  source: MedicalDataSource;
  patient: Pick<Patient, "id" | "cxId">;
  type: ProgressType;
  progress: DynamicProgress;
  requestId: string;
};

/**
 * Updates the successful and error count for the given HIE which is then aggregated
 * to the patient's document query progress. Use setDocQueryProgress to update
 * the total and status. If the status is completed or failed, it will send the webhook
 *
 * @returns
 */
export async function tallyDocQueryProgress({
  patient,
  requestId,
  progress,
  type,
  source,
}: TallyDocQueryProgress): Promise<Patient> {
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

    const externalData = setHIETallyCount(existingPatient, progress, type, source);
    const patientDocProgress = getPatientDocProgressFromHies(existingPatient, externalData);

    const updatedPatient = {
      ...existingPatient.dataValues,
      data: {
        ...existingPatient.data,
        requestId,
        externalData,
        documentQueryProgress: patientDocProgress,
      },
    };

    await PatientModel.update(updatedPatient, {
      where: patientFilter,
      transaction,
    });

    return updatedPatient;
  });

  await processDocQueryProgressWebhook({
    patient: result,
    documentQueryProgress: result.data.documentQueryProgress,
    requestId,
    progressType: type,
  });

  return result;
}

export function setHIETallyCount(
  patient: PatientModel,
  progress: DynamicProgress,
  type: ProgressType,
  source: MedicalDataSource
): PatientExternalData {
  const externalData = patient.data.externalData ?? {};
  const tallySuccessful = progress.successful ?? 0;
  const tallyErrors = progress.errors ?? 0;

  const sourceData = externalData[source];
  const sourceProgress = sourceData?.documentQueryProgress ?? {};
  const sourceTotal = sourceProgress[type]?.total ?? 0;
  const sourceSuccessful = sourceProgress[type]?.successful ?? 0;
  const sourceErrors = sourceProgress[type]?.errors ?? 0;

  const totalSuccessful = sourceSuccessful + tallySuccessful;
  const totalErrors = sourceErrors + tallyErrors;

  const docQueryProgress: DocumentQueryProgress = {
    ...sourceProgress,
    [type]: {
      ...sourceProgress[type],
      successful: sourceSuccessful + tallySuccessful,
      errors: sourceErrors + tallyErrors,
      status: getStatusFromProgress({
        successful: totalSuccessful,
        errors: totalErrors,
        total: sourceTotal,
      }),
    },
  };

  externalData[source] = {
    ...externalData[source],
    documentQueryProgress: docQueryProgress,
  };

  return externalData;
}

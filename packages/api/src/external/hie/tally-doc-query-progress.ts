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
import { aggregateAndSetHIEProgresses } from "./set-doc-query-progress";

export type DynamicProgress = Pick<Progress, "successful" | "errors">;

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
  patient: { id, cxId },
  requestId,
  progress,
  type,
  source,
}: TallyDocQueryProgress): Promise<Patient> {
  const patientFilter = { id, cxId };
  const patient = await executeOnDBTx(PatientModel.prototype, async transaction => {
    const patient = await getPatientOrFail({
      ...patientFilter,
      lock: true,
      transaction,
    });

    // Set the doc query progress for the chosen hie
    const externalData = setHIETallyCount(patient, progress, type, source);

    const existingPatientDocProgress = patient.data.documentQueryProgress ?? {};

    const aggregatedDocProgresses = aggregateAndSetHIEProgresses(
      existingPatientDocProgress,
      externalData
    );

    const updatedPatient = {
      ...patient,
      data: {
        ...patient.data,
        requestId,
        externalData,
        documentQueryProgress: aggregatedDocProgresses,
      },
    };

    await PatientModel.update(updatedPatient, { where: patientFilter, transaction });

    return updatedPatient;
  });

  await processDocQueryProgressWebhook({
    patient,
    documentQueryProgress: patient.data.documentQueryProgress,
    requestId,
    progressType: type,
  });

  return patient;
}

export function setHIETallyCount(
  patient: Patient,
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
      total: sourceTotal,
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

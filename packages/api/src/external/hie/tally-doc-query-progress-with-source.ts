import { DocumentQueryProgress, Progress } from "@metriport/core/domain/document-query";
import { getStatusFromProgress } from "@metriport/core/domain/document-query";
import { MedicalDataSource } from "@metriport/core/external/index";
import { PatientExternalData } from "@metriport/core/domain//patient";
import { ProgressType } from "@metriport/core/domain/document-query";
import { Patient } from "@metriport/core/domain/patient";
import { PatientModel } from "../../models/medical/patient";
import { executeOnDBTx } from "../../models/transaction-wrapper";
import { getPatientOrFail } from "../../command/medical/patient/get-patient";
import { handleWebhookBeingSent } from "../../command/medical/document/process-doc-query-webhook";
import { PatientDataCommonwell } from "../commonwell/patient-shared";
import { PatientDataCarequality } from "../carequality/patient-shared";
import { aggregateAndSetHieProgresses } from "./set-doc-query-progress-with-source";

export type HIEPatientData = PatientDataCommonwell | PatientDataCarequality;

type DynamicProgress = Pick<Progress, "successful" | "errors">;

export type SetDocQueryProgressWithSource = {
  source: MedicalDataSource;
  downloadProgress?: DynamicProgress | undefined | null;
  convertProgress?: DynamicProgress | undefined | null;
  patient: Pick<Patient, "id" | "cxId">;
  requestId: string;
};

/**
 * Updates the successful and error count for the given hie which is then aggregated
 * to the patient's document query progress.
 * @returns
 */
export async function tallyDocQueryProgressWithSource({
  patient,
  requestId,
  downloadProgress,
  convertProgress,
  source,
}: SetDocQueryProgressWithSource): Promise<Patient> {
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

    // Set the doc query progress for the given hie
    const externalData = setHieTallyCount(
      existingPatient,
      downloadProgress,
      convertProgress,
      source
    );

    const updatedPatient = aggregateAndSetHieProgresses(existingPatient, externalData, requestId);

    await PatientModel.update(updatedPatient, {
      where: patientFilter,
      transaction,
    });

    return updatedPatient;
  });

  handleWebhookBeingSent({
    patient: result,
    requestId,
  });

  return result;
}

export function setHieTallyCount(
  patient: PatientModel,
  downloadProgress: DynamicProgress | undefined | null,
  convertProgress: DynamicProgress | undefined | null,
  source: MedicalDataSource
): PatientExternalData {
  const externalData = patient.data.externalData ?? {};
  let tallyType: ProgressType | undefined;
  let tallySuccessful = 0;
  let tallyErrors = 0;

  if (downloadProgress) {
    tallyType = "download";
    tallySuccessful = downloadProgress.successful ?? 0;
    tallyErrors = downloadProgress.errors ?? 0;
  } else if (convertProgress) {
    tallyType = "convert";
    tallySuccessful = convertProgress.successful ?? 0;
    tallyErrors = convertProgress.errors ?? 0;
  }

  if (!tallyType) {
    throw new Error("Either downloadProgress or convertProgress must be provided");
  }

  const sourceData = externalData[source] as HIEPatientData;
  const sourceProgress = sourceData?.documentQueryProgress ?? {};
  const sourceTotal = sourceProgress[tallyType]?.total ?? 0;
  const sourceSuccessful = sourceProgress[tallyType]?.successful ?? 0;
  const sourceErrors = sourceProgress[tallyType]?.errors ?? 0;

  const totalSuccessful = sourceSuccessful + tallySuccessful;
  const totalErrors = sourceErrors + tallyErrors;

  const docQueryProgress: DocumentQueryProgress = {
    ...sourceProgress,
    [tallyType]: {
      ...sourceProgress[tallyType],
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

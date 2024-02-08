import { Progress, DocumentQueryProgress } from "@metriport/core/domain/document-query";
import { MedicalDataSource } from "@metriport/core/external/index";
import { PatientExternalData } from "@metriport/core/domain//patient";
import { progressTypes } from "@metriport/core/domain/document-query";
import { DocumentQueryStatus } from "@metriport/core/domain/document-query";
import { Patient } from "@metriport/core/domain/patient";
import { PatientModel } from "../../models/medical/patient";
import { executeOnDBTx } from "../../models/transaction-wrapper";
import {
  SetDocQueryProgressBase,
  setDocQueryProgress,
} from "../../command/medical/patient/append-doc-query-progress";
import { getPatientOrFail } from "../../command/medical/patient/get-patient";
import { getCWData } from "../commonwell/patient";
import { getCQData } from "../carequality/patient";
import { processDocQueryProgressWebhook } from "../../command/medical/document/process-doc-query-webhook";

type StaticProgress = Pick<Progress, "status" | "total">;

export type SetDocQueryProgressWithSource = {
  source: MedicalDataSource;
  downloadProgress?: StaticProgress | undefined;
  convertProgress?: StaticProgress | undefined;
} & SetDocQueryProgressBase;

/**
 * Updates the total and status for the given HIE which is then aggregated
 * to the patient's document query progress. Use tallyDocQueryProgressWithSource to update
 * the successful and error count.
 *
 * @returns
 */
export async function setDocQueryProgressWithSource({
  patient,
  requestId,
  downloadProgress,
  convertProgress,
  convertibleDownloadErrors,
  increaseCountConvertible,
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
    const externalData = setHIEDocProgress(
      existingPatient,
      downloadProgress,
      convertProgress,
      source,
      convertibleDownloadErrors,
      increaseCountConvertible
    );

    const aggregatedDocProgresses = aggregateAndSetHIEProgresses(existingPatient, externalData);

    const updatedPatient = {
      ...existingPatient,
      data: {
        ...existingPatient.data,
        externalData,
        documentQueryProgress: aggregatedDocProgresses,
      },
    };

    await PatientModel.update(updatedPatient, {
      where: patientFilter,
      transaction,
    });

    return updatedPatient;
  });

  await processDocQueryProgressWebhook({
    patient: result.dataValues,
    documentQueryProgress: result.data.documentQueryProgress,
    requestId,
  });

  return result;
}

export function aggregateAndSetHIEProgresses(
  existingPatient: PatientModel,
  updatedExternalData: PatientExternalData
) {
  const documentQueryProgress = !existingPatient.data.documentQueryProgress
    ? {}
    : existingPatient.data.documentQueryProgress;

  // Set the aggregated doc query progress for the patient
  const externalQueryProgresses = flattenDocQueryProgressWithExternal(updatedExternalData);

  const aggregatedDocProgress = aggregateDocProgress(externalQueryProgresses);

  const updatedDocumentQueryProgress = {
    ...documentQueryProgress,
    ...aggregatedDocProgress,
  };

  return updatedDocumentQueryProgress;
}

export function setHIEDocProgress(
  patient: PatientModel,
  downloadProgress: Progress | undefined,
  convertProgress: Progress | undefined,
  source: MedicalDataSource,
  convertibleDownloadErrors?: number,
  increaseCountConvertible?: number
): PatientExternalData {
  const externalData = patient.data.externalData ?? {};

  const sourceData = externalData[source];

  const docQueryProgress = setDocQueryProgress(
    sourceData?.documentQueryProgress ?? {},
    downloadProgress,
    convertProgress,
    convertibleDownloadErrors,
    increaseCountConvertible
  );

  externalData[source] = {
    ...externalData[source],
    documentQueryProgress: docQueryProgress,
  };

  return externalData;
}

type RequiredProgress = Required<Omit<Progress, "webhookSent">>;

export function aggregateDocProgress(hieDocProgresses: DocumentQueryProgress[]): {
  download?: RequiredProgress;
  convert?: RequiredProgress;
} {
  const statuses: DocumentQueryStatus[] = [];

  const tallyResults = hieDocProgresses.reduce(
    (acc: { download?: RequiredProgress; convert?: RequiredProgress }, progress) => {
      for (const type of progressTypes) {
        const progressType = progress[type];

        if (!progressType) continue;

        const currTotal = progressType.total ?? 0;
        const currErrors = progressType.errors ?? 0;
        const currSuccessful = progressType.successful ?? 0;
        const accType = acc[type];
        statuses.push(progressType.status);

        if (accType) {
          accType.total += currTotal;
          accType.errors += currErrors;
          accType.successful += currSuccessful;
          accType.status = aggregateStatus(statuses);
        } else {
          acc[type] = {
            total: currTotal,
            errors: currErrors,
            successful: currSuccessful,
            status: progressType.status,
          };
        }
      }

      return acc;
    },
    {}
  );

  return tallyResults;
}

function aggregateStatus(docQueryProgress: DocumentQueryStatus[]): DocumentQueryStatus {
  const hasProcessing = docQueryProgress.some(status => status === "processing");
  const hasFailed = docQueryProgress.some(status => status === "failed");

  if (hasProcessing) return "processing";
  if (hasFailed) return "failed";

  return "completed";
}

export function flattenDocQueryProgressWithExternal(
  externalData: PatientExternalData
): DocumentQueryProgress[] {
  const cwExternalData = getCWData(externalData);
  const cqExternalData = getCQData(externalData);

  const cwProgress = cwExternalData?.documentQueryProgress ?? {};
  const cqProgress = cqExternalData?.documentQueryProgress ?? {};

  const progresses: DocumentQueryProgress[] = [cwProgress, cqProgress];

  return progresses;
}

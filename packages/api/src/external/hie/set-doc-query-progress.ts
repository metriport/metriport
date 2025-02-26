import { Progress, DocumentQueryProgress } from "@metriport/core/domain/document-query";
import { MedicalDataSource } from "@metriport/core/external/index";
import { PatientExternalData } from "@metriport/core/domain//patient";
import { progressTypes, ProgressType } from "@metriport/core/domain/document-query";
import { DocumentQueryStatus } from "@metriport/core/domain/document-query";
import { Patient } from "@metriport/core/domain/patient";
import { PatientModel } from "../../models/medical/patient";
import { executeOnDBTx } from "../../models/transaction-wrapper";
import {
  SetDocQueryProgressBase,
  aggregateDocQueryProgress,
} from "../../command/medical/patient/append-doc-query-progress";
import { getPatientOrFail } from "../../command/medical/patient/get-patient";
import { getCWData } from "../commonwell/patient";
import { getCQData } from "../carequality/patient";
import { processDocQueryProgressWebhook } from "../../command/medical/document/process-doc-query-webhook";

type StaticProgress = Pick<Progress, "status" | "total">;
type RequiredProgress = Required<Omit<Progress, "webhookSent">>;

export type SetDocQueryProgress = {
  source: MedicalDataSource;
  startedAt?: Date | undefined;
  triggerConsolidated?: boolean | undefined;
  downloadProgress?: StaticProgress | undefined;
  convertProgress?: StaticProgress | undefined;
} & SetDocQueryProgressBase;

/**
 * Updates the total and status for the given HIE which is then aggregated
 * to the patient's document query progress. Use tallyDocQueryProgress to update
 * the successful and error count.
 *
 * @returns
 */
export async function setDocQueryProgress({
  patient: { id, cxId },
  requestId,
  downloadProgress,
  convertProgress,
  convertibleDownloadErrors,
  increaseCountConvertible,
  source,
  startedAt,
  triggerConsolidated,
}: SetDocQueryProgress): Promise<Patient> {
  const patientFilter = { id, cxId };
  const patient = await executeOnDBTx(PatientModel.prototype, async transaction => {
    const patient = await getPatientOrFail({
      ...patientFilter,
      lock: true,
      transaction,
    });

    const existingExternalData = patient.data.externalData ?? {};

    const externalData = setHIEDocProgress(
      existingExternalData,
      downloadProgress,
      convertProgress,
      source,
      convertibleDownloadErrors,
      increaseCountConvertible,
      startedAt,
      triggerConsolidated
    );

    const existingPatientDocProgress = patient.data.documentQueryProgress ?? {};

    const aggregatedDocProgresses = aggregateAndSetHIEProgresses(
      existingPatientDocProgress,
      externalData
    );

    const updatedPatient = {
      ...patient,
      data: {
        ...patient.data,
        externalData,
        documentQueryProgress: aggregatedDocProgresses,
      },
    };

    await PatientModel.update(updatedPatient, { where: patientFilter, transaction });

    return updatedPatient;
  });

  await processDocQueryProgressWebhook({
    patient,
    requestId,
  });

  return patient;
}

export function aggregateAndSetHIEProgresses(
  existingPatientDocProgress: DocumentQueryProgress,
  updatedExternalData: PatientExternalData
): DocumentQueryProgress {
  // Set the aggregated doc query progress for the patient
  const externalQueryProgresses = flattenDocQueryProgressWithExternal(updatedExternalData);

  const aggregatedDocProgress = aggregateDocProgress(
    externalQueryProgresses,
    existingPatientDocProgress
  );

  const updatedDocumentQueryProgress: DocumentQueryProgress = {
    ...existingPatientDocProgress,
    ...(aggregatedDocProgress.convert
      ? {
          convert: {
            ...existingPatientDocProgress.convert,
            ...aggregatedDocProgress.convert,
          },
        }
      : {}),
    ...(aggregatedDocProgress.download
      ? {
          download: {
            ...existingPatientDocProgress.download,
            ...aggregatedDocProgress.download,
          },
        }
      : {}),
  };

  return updatedDocumentQueryProgress;
}

export function setHIEDocProgress(
  externalData: PatientExternalData,
  downloadProgress: Progress | undefined,
  convertProgress: Progress | undefined,
  source: MedicalDataSource,
  convertibleDownloadErrors?: number,
  increaseCountConvertible?: number,
  startedAt?: Date,
  triggerConsolidated?: boolean
): PatientExternalData {
  const sourceData = externalData[source];

  const docQueryProgress = aggregateDocQueryProgress(
    sourceData?.documentQueryProgress ?? {},
    downloadProgress,
    convertProgress,
    convertibleDownloadErrors,
    increaseCountConvertible
  );

  externalData[source] = {
    ...externalData[source],
    documentQueryProgress: {
      ...docQueryProgress,
      ...(startedAt !== undefined && { startedAt }),
      ...(triggerConsolidated !== undefined && { triggerConsolidated }),
    },
  };

  return externalData;
}

export function aggregateDocProgress(
  hieDocProgresses: DocumentQueryProgress[],
  existingPatientDocProgress: DocumentQueryProgress
): {
  download?: RequiredProgress;
  convert?: RequiredProgress;
} {
  const statuses: { [key in ProgressType]: DocumentQueryStatus[] } = {
    download: [],
    convert: [],
  };

  const tallyResults = hieDocProgresses.reduce(
    (acc: { download?: RequiredProgress; convert?: RequiredProgress }, progress) => {
      for (const type of progressTypes) {
        const progressType = progress[type];
        const existingProgressType = existingPatientDocProgress[type];

        if (!progressType && !existingProgressType) continue;

        const currTotal = progressType?.total ?? 0;
        const currErrors = progressType?.errors ?? 0;
        const currSuccessful = progressType?.successful ?? 0;
        const accType = acc[type];

        statuses[type].push(progressType?.status ?? "completed");

        if (accType) {
          accType.total += currTotal;
          accType.errors += currErrors;
          accType.successful += currSuccessful;
          accType.status = aggregateStatus(statuses[type]);
        } else {
          acc[type] = {
            total: currTotal,
            errors: currErrors,
            successful: currSuccessful,
            status: progressType?.status ?? "completed",
          };
        }
      }

      return acc;
    },
    {}
  );

  return tallyResults;
}

export function aggregateStatus(docQueryProgress: DocumentQueryStatus[]): DocumentQueryStatus {
  const hasProcessing = docQueryProgress.some(status => status === "processing");
  const hasFailed = docQueryProgress.some(status => status === "failed");
  const hasCompleted = docQueryProgress.some(status => status === "completed");

  if (hasProcessing) return "processing";
  if (hasCompleted) return "completed";
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

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
  patient,
  requestId,
  downloadProgress,
  convertProgress,
  convertibleDownloadErrors,
  increaseCountConvertible,
  source,
  startedAt,
  triggerConsolidated,
}: SetDocQueryProgress): Promise<Patient> {
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
    const existingHieDocProgress = externalData[source]?.documentQueryProgress ?? {};

    const hieDocProgress = getHieDocProgress(
      existingHieDocProgress,
      downloadProgress,
      convertProgress,
      convertibleDownloadErrors,
      increaseCountConvertible,
      startedAt,
      triggerConsolidated
    );

    externalData[source] = {
      ...externalData[source],
      documentQueryProgress: hieDocProgress,
    };

    const existingPatientDocProgress = existingPatient.data.documentQueryProgress ?? {};
    const hieDocProgresses = flattenHieDocProgresses(externalData);

    const patientDocProgress = getPatientDocProgressFromHies(
      existingPatientDocProgress,
      hieDocProgresses
    );

    const updatedPatient = {
      ...existingPatient.dataValues,
      data: {
        ...existingPatient.data,
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
  });

  return result;
}

export function getHieDocProgress(
  existingHieDocProgress: DocumentQueryProgress,
  downloadProgress: Progress | undefined,
  convertProgress: Progress | undefined,
  convertibleDownloadErrors?: number,
  increaseCountConvertible?: number,
  startedAt?: Date,
  triggerConsolidated?: boolean
): DocumentQueryProgress {
  const docQueryProgress = aggregateDocQueryProgress(
    existingHieDocProgress,
    downloadProgress,
    convertProgress,
    convertibleDownloadErrors,
    increaseCountConvertible
  );

  return {
    ...docQueryProgress,
    ...(startedAt !== undefined && { startedAt }),
    ...(triggerConsolidated !== undefined && { triggerConsolidated }),
  };
}

export function getPatientDocProgressFromHies(
  existingPatientDocProgress: DocumentQueryProgress,
  hieDocProgresses: DocumentQueryProgress[]
): DocumentQueryProgress {
  const statuses: { [key in ProgressType]: DocumentQueryStatus[] } = {
    download: [],
    convert: [],
  };

  const aggregatedDocProgress = hieDocProgresses.reduce(
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

  return {
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
}

function aggregateStatus(docQueryProgress: DocumentQueryStatus[]): DocumentQueryStatus {
  const hasProcessing = docQueryProgress.some(status => status === "processing");
  const hasFailed = docQueryProgress.some(status => status === "failed");
  const hasCompleted = docQueryProgress.some(status => status === "completed");

  if (hasProcessing) return "processing";
  if (hasCompleted) return "completed";
  if (hasFailed) return "failed";
  return "completed";
}

export function flattenHieDocProgresses(
  externalData: PatientExternalData
): DocumentQueryProgress[] {
  const cwExternalData = getCWData(externalData);
  const cqExternalData = getCQData(externalData);

  const cwProgress = cwExternalData?.documentQueryProgress ?? {};
  const cqProgress = cqExternalData?.documentQueryProgress ?? {};

  const progresses: DocumentQueryProgress[] = [cwProgress, cqProgress];

  return progresses;
}

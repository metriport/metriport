import { uuidv7 } from "@metriport/core/util/uuid-v7";
import { emptyFunction } from "@metriport/shared";
import { MedicalDataSource } from "@metriport/core/external/index";
import { calculateConversionProgress } from "../../../domain/medical/conversion-progress";
import {
  ConvertResult,
  DocumentQueryProgress,
  DocumentQueryStatus,
  Progress,
} from "@metriport/core/domain/document-query";
import { Patient } from "@metriport/core/domain/patient";
import { validateOptionalFacilityId } from "../../../domain/medical/patient-facility";
import { queryAndProcessDocuments as getDocumentsFromCW } from "../../../external/commonwell/document/document-query";
import { PatientModel } from "../../../models/medical/patient";
import { executeOnDBTx } from "../../../models/transaction-wrapper";
import { Util } from "../../../shared/util";
import { appendDocQueryProgress, SetDocQueryProgress } from "../patient/append-doc-query-progress";
import { getPatientOrFail } from "../patient/get-patient";
import { storeQueryInit } from "../patient/query-init";
import { areDocumentsProcessing } from "./document-status";
import { getDocumentsFromCQ } from "../../../external/carequality/document/query-documents";
import { appendDocQueryProgressWithSource } from "../../../external/hie/append-doc-query-progress-with-source";

export function isProgressEqual(a?: Progress, b?: Progress): boolean {
  return (
    a?.errors === b?.errors &&
    a?.status === b?.status &&
    a?.successful === b?.successful &&
    a?.total === b?.total
  );
}

export function isDocumentQueryProgressEqual(
  a?: DocumentQueryProgress,
  b?: DocumentQueryProgress
): boolean {
  return isProgressEqual(a?.convert, b?.convert) && isProgressEqual(a?.download, b?.download);
}

export async function queryDocumentsAcrossHIEs({
  cxId,
  patientId,
  facilityId,
  override,
  cxDocumentRequestMetadata,
  forceQuery = false,
}: {
  cxId: string;
  patientId: string;
  facilityId?: string;
  override?: boolean;
  cxDocumentRequestMetadata?: unknown;
  forceQuery?: boolean;
}): Promise<DocumentQueryProgress> {
  const { log } = Util.out(`queryDocumentsAcrossHIEs - M patient ${patientId}`);

  const patient = await getPatientOrFail({ id: patientId, cxId });

  validateOptionalFacilityId(patient, facilityId);

  const docQueryProgress = patient.data.documentQueryProgress;
  const requestId = getOrGenerateRequestId(docQueryProgress, forceQuery);

  const isCheckStatus = !forceQuery;
  if (isCheckStatus && areDocumentsProcessing(docQueryProgress)) {
    log(`Patient ${patientId} documentQueryStatus is already 'processing', skipping...`);
    return createQueryResponse("processing", patient);
  }

  const updatedPatient = await storeQueryInit({
    id: patient.id,
    cxId: patient.cxId,
    documentQueryProgress: { download: { status: "processing" } },
    requestId,
    cxDocumentRequestMetadata,
  });

  await appendDocQueryProgressWithSource({
    source: MedicalDataSource.ALL,
    patient: updatedPatient,
    requestId,
    reset: true,
  });

  getDocumentsFromCW({
    patient,
    facilityId,
    forceDownload: override,
    forceQuery,
    requestId,
  }).catch(emptyFunction);

  getDocumentsFromCQ({
    patient,
    requestId,
  }).catch(emptyFunction);

  return createQueryResponse("processing", updatedPatient);
}

export const createQueryResponse = (
  status: DocumentQueryStatus,
  patient?: Patient
): DocumentQueryProgress => {
  return {
    download: {
      status,
      ...patient?.data.documentQueryProgress?.download,
    },
    ...patient?.data.documentQueryProgress,
  };
};

type UpdateResult = {
  patient: Pick<Patient, "id" | "cxId">;
  convertResult: ConvertResult;
};

type UpdateDocQueryParams =
  | (SetDocQueryProgress & { convertResult?: never })
  | (UpdateResult & {
      downloadProgress?: never;
      convertProgress?: never;
      reset?: never;
    });

/**
 * @deprecated - call appendDocQueryProgress or updateConversionProgress directly
 */
export async function updateDocQuery(params: UpdateDocQueryParams): Promise<Patient> {
  if (params.convertResult) {
    return updateConversionProgress(params);
  }
  return appendDocQueryProgress(params);
}

export const updateConversionProgress = async ({
  patient,
  convertResult,
}: UpdateResult): Promise<Patient> => {
  const patientFilter = {
    id: patient.id,
    cxId: patient.cxId,
  };
  const { log } = Util.out(`updateConversionProgress - patient ${patient.id}`);
  return executeOnDBTx(PatientModel.prototype, async transaction => {
    const existingPatient = await getPatientOrFail({
      ...patientFilter,
      lock: true,
      transaction,
    });

    const documentQueryProgress = calculateConversionProgress({
      patient: existingPatient,
      convertResult,
    });

    const updatedPatient = {
      ...existingPatient,
      data: {
        ...existingPatient.data,
        documentQueryProgress,
      },
    };
    await PatientModel.update(updatedPatient, { where: patientFilter, transaction });

    // START TODO 785 remove this once we're confident with the flow
    const maxAttempts = 3;
    let curAttempt = 1;
    while (curAttempt++ < maxAttempts) {
      const patientPost = await getPatientOrFail({
        id: patient.id,
        cxId: patient.cxId,
        transaction,
      });
      log(
        `[txn attempt ${curAttempt}] Status post-update: ${JSON.stringify(
          patientPost.data.documentQueryProgress
        )}`
      );
      if (
        !isDocumentQueryProgressEqual(documentQueryProgress, patientPost.data.documentQueryProgress)
      ) {
        log(
          `[txn attempt ${curAttempt}] Status post-update not expected... trying to update again`
        );
        await PatientModel.update(updatedPatient, { where: patientFilter, transaction });
      } else {
        log(`[txn attempt ${curAttempt}] Status post-update is as expected!`);
        break;
      }
    }
    // END TODO 785

    return updatedPatient;
  });
};

/**
 * Returns the existing request ID if the previous query has not been entirely completed. Otherwise, returns a newly-generated request ID.
 *
 * @param docQueryProgress Progress of the previous query
 * @param forceNew Force creating a new request ID
 * @returns uuidv7 string ID for the request
 */
export function getOrGenerateRequestId(
  docQueryProgress: DocumentQueryProgress | undefined,
  forceNew = false
): string {
  if (forceNew) return generateRequestId();

  if (areDocumentsProcessing(docQueryProgress) && docQueryProgress?.requestId) {
    return docQueryProgress.requestId;
  }

  return generateRequestId();
}

const generateRequestId = (): string => uuidv7();

import { uuidv7 } from "@metriport/core/util/uuid-v7";
import { calculateConversionProgress } from "../../../domain/medical/conversion-progress";
import {
  ConvertResult,
  DocumentQueryProgress,
  DocumentQueryStatus,
  Progress,
} from "../../../domain/medical/document-query";
import { Patient } from "../../../domain/medical/patient";
import { validateOptionalFacilityId } from "../../../domain/medical/patient-facility";
import { getCxsWithEnhancedCoverageFeatureFlagValue } from "../../../external/aws/appConfig";
import { queryAndProcessDocuments as getDocumentsFromCW } from "../../../external/commonwell/document/document-query";
import { PatientDataCommonwell } from "../../../external/commonwell/patient-shared";
import { PatientModel } from "../../../models/medical/patient";
import { executeOnDBTx } from "../../../models/transaction-wrapper";
import { Util, emptyFunction } from "../../../shared/util";
import { SetDocQueryProgress, appendDocQueryProgress } from "../patient/append-doc-query-progress";
import { getPatientOrFail, getPatientWithDependencies } from "../patient/get-patient";
import { storeQueryInit } from "../patient/query-init";
import { areDocumentsProcessing } from "./document-status";
import { setCommonwellLinkStatusToFailed } from "../../../external/commonwell/patient-external-data";
import cwCommands from "../../../external/commonwell";

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

// TODO: eventually we will have to update this to support multiple HIEs
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

  const externalData = patient.data.externalData?.COMMONWELL;
  if (!externalData) return createQueryResponse("failed");

  const cwData = externalData as PatientDataCommonwell;
  if (!cwData.patientId) return createQueryResponse("failed");

  const updatedPatient = await storeQueryInit({
    id: patient.id,
    cxId: patient.cxId,
    documentQueryProgress: { download: { status: "processing" } },
    requestId,
    cxDocumentRequestMetadata,
  });

  const cwLinkingStatus = cwData.status;
  if (cwLinkingStatus === "processing") {
    log(`Patient ${patientId} is already 'processing', waiting for timeout ...`);
    await new Promise(resolve => setTimeout(resolve, 5000));
    const patientPostTimeout = await getPatientOrFail({ id: patientId, cxId });

    const cwLinkingStatusPostTimeout = (
      patientPostTimeout.data.externalData?.COMMONWELL as PatientDataCommonwell
    ).status;
    if (cwLinkingStatusPostTimeout === "processing" || cwLinkingStatusPostTimeout === "failed") {
      log(
        `Patient ${patientId} is still 'processing' after timeout, setting DQ and cwLinking status to failed`
      );
      await setCommonwellLinkStatusToFailed({ patientId, cxId });
      const failedPatient = await storeQueryInit({
        id: patient.id,
        cxId: patient.cxId,
        documentQueryProgress: { download: { status: "failed" } },
        requestId,
        cxDocumentRequestMetadata,
      });
      return createQueryResponse("failed", failedPatient);
    } else {
      log(`Patient ${patientId} is linked after timeout, continuing with DQ`);
    }
  } else if (cwLinkingStatus === "failed") {
    log(`Patient ${patientId} is already 'failed', retrying linking...`);
    const { facilities } = await getPatientWithDependencies({ id: patientId, cxId });
    facilityId = facilityId ?? facilities[0].id;

    // retry linking
    try {
      await Promise.race([
        cwCommands.patient.retryLinking(patient, facilityId),
        new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 5000)), // timeout after 5000 ms or 5 seconds
      ]);
      log(`Patient ${patientId} retry linking successful, continuing with DQ`);
    } catch (error) {
      log(
        `Patient ${patientId} retry linking failed or timed out, setting DQ and cwLinking status to failed`
      );
      await setCommonwellLinkStatusToFailed({ patientId, cxId });
      const failedPatient = await storeQueryInit({
        id: patient.id,
        cxId: patient.cxId,
        documentQueryProgress: { download: { status: "failed" } },
        requestId,
        cxDocumentRequestMetadata,
      });
      return createQueryResponse("failed", failedPatient);
    }
  }
  // if cwLinkingStatus is completed then continue with DQ

  const cxsWithEnhancedCoverageFeatureFlagValue =
    await getCxsWithEnhancedCoverageFeatureFlagValue();
  if (forceQuery || !cxsWithEnhancedCoverageFeatureFlagValue.includes(patient.cxId)) {
    // kick off document query unless the cx has the enhanced coverage feature enabled
    getDocumentsFromCW({
      patient,
      facilityId,
      forceDownload: override,
      requestId,
    }).catch(emptyFunction);
  }

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

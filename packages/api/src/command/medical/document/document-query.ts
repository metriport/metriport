import { uuidv7 } from "@metriport/core/util/uuid-v7";
import { calculateConversionProgress } from "../../../domain/medical/conversion-progress";
import {
  ConvertResult,
  DocumentQueryProgress,
  DocumentQueryStatus,
  Progress,
} from "../../../domain/medical/document-query";
import { Patient } from "../../../domain/medical/patient";
import { isPatientAssociatedWithFacility } from "../../../domain/medical/patient-facility";
import BadRequestError from "../../../errors/bad-request";
import { getCxsWithEnhancedCoverageFeatureFlagValue } from "../../../external/aws/appConfig";
import { queryAndProcessDocuments as getDocumentsFromCW } from "../../../external/commonwell/document/document-query";
import { PatientDataCommonwell } from "../../../external/commonwell/patient-shared";
import { PatientModel } from "../../../models/medical/patient";
import { executeOnDBTx } from "../../../models/transaction-wrapper";
import { emptyFunction, Util } from "../../../shared/util";
import { appendDocQueryProgress, SetDocQueryProgress } from "../patient/append-doc-query-progress";
import { getPatientOrFail } from "../patient/get-patient";
import { areDocumentsProcessing } from "./document-status";

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
  skipDocQueryStatusCheck = false,
}: {
  cxId: string;
  patientId: string;
  facilityId?: string;
  override?: boolean;
  cxDocumentRequestMetadata?: unknown;
  skipDocQueryStatusCheck?: boolean;
}): Promise<DocumentQueryProgress> {
  const { log } = Util.out(`queryDocumentsAcrossHIEs - M patient ${patientId}`);

  const patient = await getPatientOrFail({ id: patientId, cxId });
  if (facilityId && !isPatientAssociatedWithFacility(patient, facilityId)) {
    throw new BadRequestError(`Patient not associated with given facility`, undefined, {
      patientId: patient.id,
      facilityId,
    });
  }
  if (!facilityId && patient.facilityIds.length > 1) {
    throw new BadRequestError(
      `Patient is associated with more than one facility (facilityId is required)`,
      undefined,
      {
        patientId: patient.id,
        facilityIdCount: patient.facilityIds.length,
      }
    );
  }
  const docQueryProgress = patient.data.documentQueryProgress;
  const requestId = getOrGenerateRequestId(docQueryProgress, skipDocQueryStatusCheck);

  const isCheckStatus = !skipDocQueryStatusCheck;
  if (isCheckStatus && areDocumentsProcessing(docQueryProgress)) {
    log(`Patient ${patientId} documentQueryStatus is already 'processing', skipping...`);
    return createQueryResponse("processing", patient);
  }

  const externalData = patient.data.externalData?.COMMONWELL;
  if (!externalData) return createQueryResponse("failed");

  const cwData = externalData as PatientDataCommonwell;
  if (!cwData.patientId) return createQueryResponse("failed");

  const updatedPatient = await updateDocQuery({
    patient: { id: patient.id, cxId: patient.cxId },
    downloadProgress: { status: "processing" },
    requestId,
    reset: true,
    cxDocumentRequestMetadata,
  });

  const cxsWithEnhancedCoverageFeatureFlagValue =
    await getCxsWithEnhancedCoverageFeatureFlagValue();
  if (!cxsWithEnhancedCoverageFeatureFlagValue.includes(patient.cxId)) {
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
  cxDocumentRequestMetadata?: unknown;
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
  cxDocumentRequestMetadata,
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
        cxDocumentRequestMetadata:
          cxDocumentRequestMetadata !== undefined
            ? (cxDocumentRequestMetadata as Record<string, string>)
            : existingPatient.data.cxDocumentRequestMetadata,
        whOverride:
          (cxDocumentRequestMetadata as { meta?: { whOverrideFlag?: boolean } })?.meta
            ?.whOverrideFlag === true
            ? true
            : false,
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
function getOrGenerateRequestId(
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

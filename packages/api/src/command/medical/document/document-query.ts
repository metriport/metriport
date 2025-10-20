import { deleteConsolidated } from "@metriport/core/command/consolidated/consolidated-delete";
import {
  isCarequalityEnabled,
  isCommonwellEnabled,
  isXmlRedownloadFeatureFlagEnabledForCx,
} from "@metriport/core/command/feature-flags/domain-ffs";
import {
  ConvertResult,
  DocumentQueryProgress,
  DocumentQueryStatus,
  Progress,
} from "@metriport/core/domain/document-query";
import { Patient } from "@metriport/core/domain/patient";
import { analytics, EventTypes } from "@metriport/core/external/analytics/posthog";
import { MedicalDataSource } from "@metriport/core/external/index";
import { out } from "@metriport/core/util/log";
import { uuidv7 } from "@metriport/core/util/uuid-v7";
import { BadRequestError, emptyFunction } from "@metriport/shared";
import { calculateConversionProgress } from "../../../domain/medical/conversion-progress";
import { isPatientAssociatedWithFacility } from "../../../domain/medical/patient-facility";
import { processAsyncError } from "../../../errors";
import { getDocumentsFromCQ } from "../../../external/carequality/document/query-documents";
import { queryAndProcessDocuments as getDocumentsFromCW } from "../../../external/commonwell/document/document-query";
import { getCqOrgIdsToDenyOnCw } from "../../../external/hie/cross-hie-ids";
import { resetDocQueryProgress } from "../../../external/hie/reset-doc-query-progress";
import { PatientModel } from "../../../models/medical/patient";
import { executeOnDBTx } from "../../../models/transaction-wrapper";
import { getPatientOrFail } from "../patient/get-patient";
import { storeDocumentQueryInitialState } from "./document-query-init";
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

export async function queryDocumentsAcrossHIEs({
  cxId,
  patientId,
  facilityId,
  requestId: requestIdParam,
  forceDownload,
  cxDocumentRequestMetadata,
  forcePatientDiscovery = false,
  forceCommonwell = false,
  forceCarequality = false,
  cqManagingOrgName,
  triggerConsolidated = false,
}: {
  cxId: string;
  patientId: string;
  facilityId: string;
  requestId?: string | undefined;
  forceDownload?: boolean;
  cxDocumentRequestMetadata?: unknown;
  forcePatientDiscovery?: boolean;
  forceCommonwell?: boolean;
  forceCarequality?: boolean;
  cqManagingOrgName?: string;
  triggerConsolidated?: boolean;
}): Promise<DocumentQueryProgress> {
  const { log } = out(`queryDocumentsAcrossHIEs - M patient ${patientId}`);

  const [patient, commonwellEnabled, carequalityEnabled] = await Promise.all([
    getPatientOrFail({ id: patientId, cxId }),
    isCommonwellEnabled(),
    isCarequalityEnabled(),
  ]);

  const isQueryCarequality = carequalityEnabled || forceCarequality;
  /**
   * It's likely safe to remove `cqManagingOrgName` based on the usage of this function.
   * But because it touches a core flow and we don't have time to review/test it now, leaving as is.
   * The expected behavior is that we never pass `cqManagingOrgName`, so it should be null/undefined every
   * time this function is called - otherwise we can miss the opportunity to query CW for docs.
   * @see https://metriport.slack.com/archives/C04DMKE9DME/p1745685924702559
   */
  const isQueryCommonwell = (commonwellEnabled || forceCommonwell) && !cqManagingOrgName;

  if (!isQueryCarequality && !isQueryCommonwell) {
    log("No HIE networks enabled, skipping DQ for Commonwell and Carequality");
    return createQueryResponse("completed", patient);
  }

  if (patient.hieOptOut) {
    throw new BadRequestError("Patient has opted out from the networks");
  }

  if (!isPatientAssociatedWithFacility(patient, facilityId)) {
    throw new BadRequestError("Patient not associated with given facility", undefined, {
      patientId: patient.id,
      facilityId,
    });
  }

  const docQueryProgress = patient.data.documentQueryProgress;
  const requestId = requestIdParam ?? getOrGenerateRequestId(docQueryProgress);

  if (areDocumentsProcessing(docQueryProgress)) {
    log(`Patient ${patientId} documentQueryStatus is already 'processing', skipping...`);
    return createQueryResponse("processing", patient);
  }

  await resetDocQueryProgress({
    source: MedicalDataSource.ALL,
    patient,
  });

  const startedAt = new Date();

  const updatedPatient = await storeDocumentQueryInitialState({
    id: patient.id,
    cxId: patient.cxId,
    documentQueryProgress: {
      requestId,
      startedAt,
      triggerConsolidated,
    },
    cxDocumentRequestMetadata,
    enabledHIEs: [
      ...(isQueryCommonwell ? [MedicalDataSource.COMMONWELL] : []),
      ...(isQueryCarequality ? [MedicalDataSource.CAREQUALITY] : []),
    ],
  });

  analytics({
    event: EventTypes.documentQuery,
    distinctId: cxId,
    properties: {
      requestId,
      patientId,
    },
  });

  let triggeredDocumentQuery = false;

  const isForceRedownloadEnabled =
    forceDownload ?? (await isXmlRedownloadFeatureFlagEnabledForCx(cxId));

  if (isQueryCommonwell) {
    getDocumentsFromCW({
      patient: updatedPatient,
      facilityId,
      forceDownload: isForceRedownloadEnabled,
      forcePatientDiscovery,
      requestId,
      getOrgIdExcludeList: getCqOrgIdsToDenyOnCw,
    }).catch(emptyFunction);
    triggeredDocumentQuery = true;
  }

  if (isQueryCarequality) {
    getDocumentsFromCQ({
      patient: updatedPatient,
      facilityId,
      forceDownload: isForceRedownloadEnabled,
      requestId,
      cqManagingOrgName,
      forcePatientDiscovery,
    }).catch(emptyFunction);
    triggeredDocumentQuery = true;
  }

  if (triggeredDocumentQuery) {
    deleteConsolidated({
      cxId: patient.cxId,
      patientId: patient.id,
    }).catch(processAsyncError("Failed to delete consolidated bundle"));
  }

  return createQueryResponse("processing", updatedPatient);
}

export function createQueryResponse(
  status: DocumentQueryStatus,
  patient?: Patient
): DocumentQueryProgress {
  return {
    download: {
      status,
      ...patient?.data.documentQueryProgress?.download,
    },
    ...patient?.data.documentQueryProgress,
  };
}

type UpdateResult = {
  patient: Pick<Patient, "id" | "cxId">;
  convertResult: ConvertResult;
  count?: number;
  log?: typeof console.log;
};

export async function updateConversionProgress({
  patient: { id, cxId },
  convertResult,
  count,
  log = out(`updateConversionProgress - patient ${id}, cxId ${cxId}`).log,
}: UpdateResult): Promise<Patient> {
  const patientFilter = { id, cxId };
  return executeOnDBTx(PatientModel.prototype, async transaction => {
    const patient = await getPatientOrFail({
      ...patientFilter,
      lock: true,
      transaction,
    });

    const docQueryProgress = patient.data.documentQueryProgress;
    log(`Status pre-update: ${JSON.stringify(docQueryProgress)}`);

    const documentQueryProgress = calculateConversionProgress({
      patient,
      convertResult,
      count,
    });

    const updatedPatient = {
      ...patient,
      data: {
        ...patient.data,
        documentQueryProgress,
      },
    };

    await PatientModel.update(updatedPatient, { where: patientFilter, transaction });

    return updatedPatient;
  });
}

/**
 * Returns the existing request ID if the previous query has not been entirely completed. Otherwise, returns a newly-generated request ID.
 *
 * @param docQueryProgress Progress of the previous query
 * @returns uuidv7 string ID for the request
 */
export function getOrGenerateRequestId(
  docQueryProgress: DocumentQueryProgress | undefined
): string {
  if (areDocumentsProcessing(docQueryProgress) && docQueryProgress?.requestId) {
    return docQueryProgress.requestId;
  }

  return generateRequestId();
}

function generateRequestId(): string {
  return uuidv7();
}

import { deleteConsolidated } from "@metriport/core/command/consolidated/consolidated-delete";
import {
  ConvertResult,
  DocumentQueryProgress,
  DocumentQueryStatus,
  Progress,
} from "@metriport/core/domain/document-query";
import { Patient } from "@metriport/core/domain/patient";
import { analytics, EventTypes } from "@metriport/core/external/analytics/posthog";
import { MedicalDataSource } from "@metriport/core/external/index";
import { uuidv7 } from "@metriport/core/util/uuid-v7";
import { emptyFunction, BadRequestError } from "@metriport/shared";
import { calculateConversionProgress } from "../../../domain/medical/conversion-progress";
import { validateOptionalFacilityId } from "../../../domain/medical/patient-facility";
import { processAsyncError } from "../../../errors";
import { isCarequalityEnabled, isCommonwellEnabled } from "../../../external/aws/app-config";
import { getDocumentsFromCQ } from "../../../external/carequality/document/query-documents";
import { queryAndProcessDocuments as getDocumentsFromCW } from "../../../external/commonwell/document/document-query";
import { getCqOrgIdsToDenyOnCw } from "../../../external/hie/cross-hie-ids";
import { resetDocQueryProgress } from "../../../external/hie/reset-doc-query-progress";
import { PatientModel } from "../../../models/medical/patient";
import { executeOnDBTx } from "../../../models/transaction-wrapper";
import { Util } from "../../../shared/util";
import { getPatientOrFail } from "../patient/get-patient";
import { storeQueryInit } from "../patient/query-init";
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
  override,
  cxDocumentRequestMetadata,
  forceQuery = false,
  forcePatientDiscovery = false,
  forceCommonwell = false,
  forceCarequality = false,
  cqManagingOrgName,
  triggerConsolidated = false,
}: {
  cxId: string;
  patientId: string;
  facilityId?: string;
  override?: boolean;
  cxDocumentRequestMetadata?: unknown;
  forceQuery?: boolean;
  forcePatientDiscovery?: boolean;
  forceCommonwell?: boolean;
  forceCarequality?: boolean;
  cqManagingOrgName?: string;
  triggerConsolidated?: boolean;
}): Promise<DocumentQueryProgress> {
  const { log } = Util.out(`queryDocumentsAcrossHIEs - M patient ${patientId}`);

  const patient = await getPatientOrFail({ id: patientId, cxId });

  if (patient.hieOptOut) {
    throw new BadRequestError("Patient has opted out from the networks");
  }

  validateOptionalFacilityId(patient, facilityId);

  const docQueryProgress = patient.data.documentQueryProgress;
  const requestId = getOrGenerateRequestId(docQueryProgress, forceQuery);

  const isCheckStatus = !forceQuery;
  if (isCheckStatus && areDocumentsProcessing(docQueryProgress)) {
    log(`Patient ${patientId} documentQueryStatus is already 'processing', skipping...`);
    return createQueryResponse("processing", patient);
  }

  await resetDocQueryProgress({
    source: MedicalDataSource.ALL,
    patient,
  });

  const startedAt = new Date();

  const updatedPatient = await storeQueryInit({
    id: patient.id,
    cxId: patient.cxId,
    cmd: {
      documentQueryProgress: {
        requestId,
        startedAt,
        triggerConsolidated,
        download: { status: "processing" },
      },
      cxDocumentRequestMetadata,
    },
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

  const commonwellEnabled = await isCommonwellEnabled();
  // Why? Please add a comment explaining why we're not running CW if there's no CQ managing org name.
  if (!cqManagingOrgName) {
    if (commonwellEnabled || forceCommonwell) {
      getDocumentsFromCW({
        patient: updatedPatient,
        facilityId,
        forceDownload: override,
        forceQuery,
        forcePatientDiscovery,
        requestId,
        getOrgIdExcludeList: getCqOrgIdsToDenyOnCw,
      }).catch(emptyFunction);
      triggeredDocumentQuery = true;
    }
  }

  const carequalityEnabled = await isCarequalityEnabled();
  if (carequalityEnabled || forceCarequality) {
    getDocumentsFromCQ({
      patient: updatedPatient,
      facilityId,
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

export const updateConversionProgress = async ({
  patient,
  convertResult,
}: UpdateResult): Promise<Patient> => {
  const patientFilter = {
    id: patient.id,
    cxId: patient.cxId,
  };
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
      ...existingPatient.dataValues,
      data: {
        ...existingPatient.data,
        documentQueryProgress,
      },
    };
    await PatientModel.update(updatedPatient, { where: patientFilter, transaction });

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

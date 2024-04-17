import {
  ConvertResult,
  DocumentQueryProgress,
  DocumentQueryStatus,
  Progress,
} from "@metriport/core/domain/document-query";
import { Patient } from "@metriport/core/domain/patient";
import { MedicalDataSource } from "@metriport/core/external/index";
import { uuidv7 } from "@metriport/core/util/uuid-v7";
import { emptyFunction } from "@metriport/shared";
import { calculateConversionProgress } from "../../../domain/medical/conversion-progress";
import { validateOptionalFacilityId } from "../../../domain/medical/patient-facility";
import { isCarequalityEnabled, isCommonwellEnabled } from "../../../external/aws/appConfig";
import { getDocumentsFromCQ } from "../../../external/carequality/document/query-documents";
import { queryAndProcessDocuments as getDocumentsFromCW } from "../../../external/commonwell/document/document-query";
import { resetDocQueryProgress } from "../../../external/hie/reset-doc-query-progress";
import { PatientModel } from "../../../models/medical/patient";
import { executeOnDBTx } from "../../../models/transaction-wrapper";
import { Config } from "../../../shared/config";
import { Util } from "../../../shared/util";
import { getPatientOrFail } from "../patient/get-patient";
import { storeQueryInit } from "../patient/query-init";
import { areDocumentsProcessing } from "./document-status";
import { getCqOrgIdsToDenyOnCw } from "../hie";

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
  forceCommonwell = false,
  forceCarequality = false,
}: {
  cxId: string;
  patientId: string;
  facilityId?: string;
  override?: boolean;
  cxDocumentRequestMetadata?: unknown;
  forceQuery?: boolean;
  forceCommonwell?: boolean;
  forceCarequality?: boolean;
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

  await resetDocQueryProgress({
    source: MedicalDataSource.ALL,
    patient,
  });

  const updatedPatient = await storeQueryInit({
    id: patient.id,
    cxId: patient.cxId,
    documentQueryProgress: { download: { status: "processing" } },
    requestId,
    cxDocumentRequestMetadata,
  });

  const commonwellEnabled = await isCommonwellEnabled();
  if (commonwellEnabled || forceCommonwell || Config.isSandbox()) {
    getDocumentsFromCW({
      patient,
      facilityId,
      forceDownload: override,
      forceQuery,
      requestId,
      getOrgIdExcludeList: getCqOrgIdsToDenyOnCw,
    }).catch(emptyFunction);
  }

  const carequalityEnabled = await isCarequalityEnabled();
  if (carequalityEnabled || forceCarequality) {
    getDocumentsFromCQ({
      patient,
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

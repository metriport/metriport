import { uuidv7 } from "@metriport/core/util/uuid-v7";
import {
  calculateConversionProgress,
  ConvertResult,
  DocumentQueryProgress,
  DocumentQueryStatus,
  isDocumentQueryProgressEqual,
} from "../../../domain/medical/document-query";
import { DocRequest } from "../../../domain/medical/doc-request";
import { Patient } from "../../../domain/medical/patient";
import { isPatientAssociatedWithFacility } from "../../../domain/medical/patient-facility";
import BadRequestError from "../../../errors/bad-request";
import { queryAndProcessDocuments as getDocumentsFromCW } from "../../../external/commonwell/document/document-query";
import { PatientDataCommonwell } from "../../../external/commonwell/patient-shared";
import { PatientModel } from "../../../models/medical/patient";
import { executeOnDBTx } from "../../../models/transaction-wrapper";
import { emptyFunction, Util } from "../../../shared/util";
import { getPatientOrFail } from "../patient/get-patient";

import {
  appendDocRequestQueryProgress,
  SetDocRequestQueryProgress,
} from "../doc-request/append-doc-request-query-progress";
import { getDocRequestOrFail } from "../doc-request/get-doc-request";
import { DocRequestModel } from "../../../models/medical/doc-request";

// TODO: eventually we will have to update this to support multiple HIEs
export async function queryDocumentsAcrossHIEs({
  cxId,
  patientId,
  facilityId,
  docRequest,
  override,
}: {
  cxId: string;
  patientId: string;
  facilityId?: string;
  docRequest: DocRequest;
  override?: boolean;
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

  // Doc Request should be undefined here, since a new DocRequest is created each time the endpoint is called.
  const docQueryProgress = docRequest.documentQueryProgress;
  console.log("Doc Request Object: ", docQueryProgress);
  const requestId = getOrGenerateRequestId(docQueryProgress);

  if (
    docQueryProgress?.download?.status === "processing" ||
    docQueryProgress?.convert?.status === "processing"
  ) {
    log(`Patient ${patientId} documentQueryStatus is already 'processing', skipping...`);
    return createQueryDocRequestResponse("processing", docRequest);
  }

  const externalData = patient.data.externalData?.COMMONWELL;
  if (!externalData) return createQueryDocRequestResponse("failed");

  const cwData = externalData as PatientDataCommonwell;
  if (!cwData.patientId) return createQueryDocRequestResponse("failed");

  const [updatedDocRequest, updatedPatient] = await appendDocRequestQueryProgress({
    patient: { id: patient.id, cxId: patient.cxId },
    docRequest,
    downloadProgress: { status: "processing" },
    requestId,
    reset: true,
  });

  // TODP: is there anything to do with updated patient
  console.log("Updated Patient: ", JSON.stringify(updatedPatient));

  getDocumentsFromCW({
    patient,
    facilityId,
    forceDownload: override,
    requestId,
  }).catch(emptyFunction);

  return createQueryDocRequestResponse("processing", updatedDocRequest);
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

export const createQueryDocRequestResponse = (
  status: DocumentQueryStatus,
  docRequest?: DocRequest
): DocumentQueryProgress => {
  return {
    download: {
      status,
      ...docRequest?.documentQueryProgress?.download,
    },
    ...docRequest?.documentQueryProgress,
  };
};

type UpdateDocRequestResult = {
  patient: Pick<Patient, "id" | "cxId">;
  docRequest: Pick<DocRequest, "id" | "cxId">;
  convertResult: ConvertResult;
};

export type UpdateDocRequestQueryParams =
  | (SetDocRequestQueryProgress & { convertResult?: never })
  | (UpdateDocRequestResult & {
      downloadProgress?: never;
      convertProgress?: never;
      reset?: never;
    });

/**
 * @deprecated - call appendDocQueryProgress or updateConversionProgress directly
 */
export async function updateDocRequestQuery(
  params: UpdateDocRequestQueryParams
): Promise<[DocRequest, Patient?]> {
  if (params.convertResult) {
    return updateDocRequestConversionProgress(params);
  }
  return appendDocRequestQueryProgress(params);
}

export const updateDocRequestConversionProgress = async ({
  docRequest,
  convertResult,
}: UpdateDocRequestResult): Promise<[DocRequest]> => {
  const docRequestFilter = {
    id: docRequest.id,
    cxId: docRequest.cxId,
  };
  const { log } = Util.out(`updateConversionProgress - doc request id ${docRequest.id}`);
  return executeOnDBTx(PatientModel.prototype, async transaction => {
    const existingDocRequest = await getDocRequestOrFail({
      ...docRequestFilter,
      lock: true,
      transaction,
    });

    const documentQueryProgress = calculateConversionProgress({
      docQueryProgress: existingDocRequest.documentQueryProgress,
      convertResult,
    });

    const updatedDocRequest: DocRequest = {
      ...existingDocRequest,
      documentQueryProgress,
    };

    await DocRequestModel.update(updatedDocRequest, { where: docRequestFilter, transaction });

    // START TODO 785 remove this once we're confident with the flow
    const maxAttempts = 3;
    let curAttempt = 1;
    while (curAttempt++ < maxAttempts) {
      const docRequestPost = await getDocRequestOrFail({
        ...docRequestFilter,
        lock: true,
        transaction,
      });
      log(
        `[txn attempt ${curAttempt}] Status post-update: ${JSON.stringify(
          docRequestPost.documentQueryProgress
        )}`
      );
      if (
        !isDocumentQueryProgressEqual(documentQueryProgress, docRequestPost.documentQueryProgress)
      ) {
        log(
          `[txn attempt ${curAttempt}] Status post-update not expected... trying to update again`
        );
        await DocRequestModel.update(updatedDocRequest, { where: docRequestFilter, transaction });
      } else {
        log(`[txn attempt ${curAttempt}] Status post-update is as expected!`);
        break;
      }
    }
    // END TODO 785

    return [updatedDocRequest];
  });
};

/**
 * Returns the existing request ID if the previous query has not been entirely completed. Otherwise, returns a newly-generated request ID.
 *
 * @param docQueryProgress Progress of the previous query
 * @returns uuidv7 string ID for the request
 */
function getOrGenerateRequestId(docQueryProgress: DocumentQueryProgress | undefined): string {
  if (!docQueryProgress) return uuidv7();

  const isDownloadFinished = docQueryProgress.download?.status === "completed";
  const conversionStatus = docQueryProgress.convert?.status ?? undefined;

  if (isDownloadFinished && (!conversionStatus || conversionStatus === "completed")) {
    return uuidv7();
  } else if (docQueryProgress.requestId) {
    return docQueryProgress.requestId;
  }
  return uuidv7();
}

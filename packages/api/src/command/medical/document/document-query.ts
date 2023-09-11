import {
  calculateConversionProgress,
  ConvertResult,
  DocumentQueryProgress,
  DocumentQueryStatus,
  Progress,
} from "../../../domain/medical/document-query";
import { queryAndProcessDocuments as getDocumentsFromCW } from "../../../external/commonwell/document/document-query";
import { PatientDataCommonwell } from "../../../external/commonwell/patient-shared";
import { Patient, PatientModel } from "../../../models/medical/patient";
import { executeOnDBTx } from "../../../models/transaction-wrapper";
import { emptyFunction, Util } from "../../../shared/util";
import { uuidv7 } from "../../../shared/uuid-v7";
import { appendDocQueryProgress, SetDocQueryProgress } from "../patient/append-doc-query-progress";
import { getPatientOrFail } from "../patient/get-patient";

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
}: {
  cxId: string;
  patientId: string;
  facilityId: string;
  override?: boolean;
}): Promise<DocumentQueryProgress> {
  const { log } = Util.out(`queryDocumentsAcrossHIEs - M patient ${patientId}`);

  const patient = await getPatientOrFail({ id: patientId, cxId });
  console.log("PATIENT RETRIEVED", JSON.stringify(patient));
  console.log("AND ESP PAT DATA", JSON.stringify(patient.data));

  const reqId = patient.data.documentQueryProgress?.requestId;
  const requestId = reqId ?? uuidv7();
  console.log("reqId", reqId, "requestId", requestId);
  if (
    patient.data.documentQueryProgress?.download?.status === "processing" ||
    patient.data.documentQueryProgress?.convert?.status === "processing"
  ) {
    log(`Patient ${patientId} documentQueryStatus is already 'processing', skipping...`);
    console.log(
      "ALREADY PROCESSING. docQueryProgress.requestId",
      patient.data.documentQueryProgress.requestId
    );
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
  });

  console.log("PATIENT UPD", updatedPatient);

  getDocumentsFromCW({
    patient,
    facilityId,
    forceDownload: override,
    requestId,
  }).catch(emptyFunction);

  const queryResp = createQueryResponse("processing", updatedPatient);
  console.log("Query Resp", JSON.stringify(queryResp));
  return queryResp;
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
  requestId?: string | undefined | null;
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
  console.log("Params", JSON.stringify(params));
  if (params.convertResult) {
    return updateConversionProgress(params);
  }
  return appendDocQueryProgress(params);
}

export const updateConversionProgress = async ({
  patient,
  convertResult,
  requestId,
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
      requestId,
    });

    console.log("DocQueryProgress UPD", requestId, documentQueryProgress);

    const updatedPatient = {
      ...existingPatient,
      data: {
        ...existingPatient.data,
        documentQueryProgress,
      },
      // dataValues: {
      //   ...existingPatient.data,
      //   documentQueryProgress,
      // },
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

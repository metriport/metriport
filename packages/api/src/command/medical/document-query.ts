import {
  DocumentQueryProgress,
  DocumentQueryStatus,
  ProgressType,
} from "@metriport/core/domain/document-query";
import { MedicalDataSource } from "@metriport/core/external/index";
import { uuidv7 } from "@metriport/core/util/uuid-v7";
import { NotFoundError } from "@metriport/shared";
import { buildDayjs } from "@metriport/shared/common/date";
import dayjs from "dayjs";
import { Op } from "sequelize";
import { DocumentQuery } from "../../domain/medical/document-query";
import { DocumentQueryModel } from "../../models/medical/documentQuery";
import { DocumentReferenceDTO } from "../../routes/medical/dtos/documentDTO";
import {
  MAPIWebhookStatus,
  processPatientDocumentRequest,
  composeDocRefPayload,
} from "./document/document-webhook";

export type DocumentQueryLookUpParams = Pick<DocumentQuery, "cxId" | "requestId" | "patientId">;
export type CurrentDocumentLookUpParams = Omit<DocumentQueryLookUpParams, "requestId">;
export type DocumentQueryCreateParams = DocumentQueryLookUpParams &
  Partial<
    Pick<
      DocumentQuery,
      "isReconvert" | "isDownloadWebhookSent" | "isConvertWebhookSent" | "metaData" | "data"
    >
  >;
export type DocumentQueryDocumentSource = MedicalDataSource | "unknown";
export type DocumentQueryIncrementField = "Error" | "Success" | "Total";

const MAX_TIME_TO_PROCESS = dayjs.duration({ minutes: 30 });
const BUFFER_TIME = dayjs.duration({ minutes: 16 });

export async function findOrCreateDocumentQuery({
  cxId,
  patientId,
  requestId,
  isReconvert = false,
  isDownloadWebhookSent = false,
  isConvertWebhookSent = false,
  metaData = null,
  data = null,
}: DocumentQueryCreateParams): Promise<DocumentQuery> {
  const existing = await getDocumentQuery({ cxId, patientId, requestId });
  if (existing) return existing;
  const created = await DocumentQueryModel.create({
    id: uuidv7(),
    cxId,
    patientId,
    requestId,
    isReconvert,
    isDownloadWebhookSent,
    isConvertWebhookSent,
    metaData,
    data,
    commonwellDownloadError: 0,
    commonwellDownloadSuccess: 0,
    commonwellDownloadTotal: 0,
    commonwellDownloadStatus: null,
    commonwellConvertError: 0,
    commonwellConvertSuccess: 0,
    commonwellConvertTotal: 0,
    commonwellConvertStatus: null,
    carequalityDownloadError: 0,
    carequalityDownloadSuccess: 0,
    carequalityDownloadTotal: 0,
    carequalityDownloadStatus: null,
    carequalityConvertError: 0,
    carequalityConvertSuccess: 0,
    carequalityConvertTotal: 0,
    carequalityConvertStatus: null,
    unknownDownloadError: 0,
    unknownDownloadSuccess: 0,
    unknownDownloadTotal: 0,
    unknownDownloadStatus: null,
    unknownConvertError: 0,
    unknownConvertSuccess: 0,
    unknownConvertTotal: 0,
    unknownConvertStatus: null,
  });
  return created.dataValues;
}

export async function getDocumentQuery({
  cxId,
  patientId,
  requestId,
}: DocumentQueryLookUpParams): Promise<DocumentQuery | undefined> {
  const existing = await DocumentQueryModel.findOne({
    where: { cxId, patientId, requestId },
  });
  if (!existing) return undefined;
  return existing.dataValues;
}

export async function getDocumentQueryOrFail({
  cxId,
  patientId,
  requestId,
}: DocumentQueryLookUpParams): Promise<DocumentQuery> {
  const existing = await getDocumentQuery({ cxId, patientId, requestId });
  if (!existing) {
    throw new NotFoundError("DocumentQuery not found", undefined, { cxId, patientId, requestId });
  }
  return existing;
}

export async function getDocumentQueryModel({
  cxId,
  patientId,
  requestId,
}: DocumentQueryLookUpParams): Promise<DocumentQueryModel | undefined> {
  const existing = await DocumentQueryModel.findOne({
    where: { cxId, patientId, requestId },
  });
  if (!existing) return undefined;
  return existing;
}

export async function getDocumentQueryModelOrFail({
  cxId,
  patientId,
  requestId,
}: DocumentQueryLookUpParams): Promise<DocumentQueryModel> {
  const existing = await getDocumentQueryModel({
    cxId,
    patientId,
    requestId,
  });
  if (!existing) {
    throw new NotFoundError("DocumentQuery not found", undefined, { cxId, patientId, requestId });
  }
  return existing;
}

type ColumnLookupParams = {
  source: DocumentQueryDocumentSource;
  progressType: ProgressType;
  field: DocumentQueryIncrementField;
};

type IncrementOrSet = DocumentQueryLookUpParams &
  ColumnLookupParams & {
    value?: number;
  };

function createColumn({
  source,
  progressType,
  field,
}: Omit<ColumnLookupParams, "field"> & {
  field: DocumentQueryIncrementField | "Status";
}): keyof DocumentQuery {
  return `${source.toLowerCase()}${progressType}${field}` as keyof DocumentQuery;
}

export async function incrementDocumentQuery({
  cxId,
  patientId,
  requestId,
  source,
  progressType,
  field,
  value = 1,
}: IncrementOrSet): Promise<DocumentQuery> {
  const existing = await getDocumentQueryModelOrFail({ cxId, patientId, requestId });
  const column = createColumn({ source, progressType, field });
  const updated = await existing.increment(column, { by: value });
  return updated.dataValues;
}

export async function incrementDocumentQueryAndProcessWebhook({
  cxId,
  patientId,
  requestId,
  source,
  progressType,
  field,
  value = 1,
}: IncrementOrSet): Promise<void> {
  const updated = await incrementDocumentQuery({
    cxId,
    patientId,
    requestId,
    source,
    progressType,
    field,
    value,
  });
  const successColumn = createColumn({ source, progressType, field: "Success" });
  const errorColumn = createColumn({ source, progressType, field: "Error" });
  const totalColumn = createColumn({ source, progressType, field: "Total" });
  if (
    (updated[successColumn] as number) + (updated[errorColumn] as number) ===
    (updated[totalColumn] as number)
  ) {
    await setDocumentQueryStatus({
      cxId,
      patientId,
      requestId,
      source,
      progressType,
      status: "completed",
    });
    let documents: DocumentReferenceDTO[] | undefined;
    if (progressType === "convert") {
      documents = await composeDocRefPayload({ cxId, patientId, requestId });
    }
    await processPatientDocumentRequest({
      cxId,
      patientId,
      requestId,
      whType:
        progressType === "download" ? "medical.document-download" : "medical.document-conversion",
      status: MAPIWebhookStatus.completed,
      documents,
    });
  }
}

export async function setDocumentQuery({
  cxId,
  patientId,
  requestId,
  source,
  progressType,
  field,
  value = 0,
}: IncrementOrSet): Promise<DocumentQuery> {
  const existing = await getDocumentQueryModelOrFail({ cxId, patientId, requestId });
  const column = createColumn({ source, progressType, field });
  const updated = await existing.update({ [column]: value });
  return updated.dataValues;
}

type SetStatus = DocumentQueryLookUpParams &
  Omit<ColumnLookupParams, "field"> & {
    status: DocumentQueryStatus;
  };

export async function setDocumentQueryStatus({
  cxId,
  patientId,
  requestId,
  source,
  progressType,
  status,
}: SetStatus): Promise<DocumentQuery> {
  const existing = await getDocumentQueryModelOrFail({ cxId, patientId, requestId });
  const column = createColumn({ source, progressType, field: "Status" });
  const updated = await existing.update({ [column]: status });
  return updated.dataValues;
}

export async function setDocumentQueryStatusAndProcessFailedWebhook({
  cxId,
  patientId,
  requestId,
  source,
  progressType,
}: SetStatus): Promise<void> {
  await setDocumentQueryStatus({
    cxId,
    patientId,
    requestId,
    source,
    progressType,
    status: "failed",
  });
  let documents: DocumentReferenceDTO[] | undefined;
  if (progressType === "convert") {
    documents = await composeDocRefPayload({ cxId, patientId, requestId });
  }
  await processPatientDocumentRequest({
    cxId,
    patientId,
    requestId,
    whType:
      progressType === "download" ? "medical.document-download" : "medical.document-conversion",
    status: MAPIWebhookStatus.failed,
    documents,
  });
}

export async function setWebhookSent({
  cxId,
  patientId,
  requestId,
  progressType,
  value,
}: DocumentQueryLookUpParams & {
  progressType: ProgressType;
  value: boolean;
}): Promise<DocumentQuery> {
  const existing = await getDocumentQueryModelOrFail({ cxId, patientId, requestId });
  const column = `is${progressType}WebhookSent` as keyof DocumentQuery;
  const updated = await existing.update({ [column]: value });
  return updated.dataValues;
}

export async function getCurrentGlobalDocumentQueryProgress({
  cxId,
  patientId,
  requestId,
}: CurrentDocumentLookUpParams & { requestId?: string }): Promise<
  DocumentQueryProgress | undefined
> {
  const existing = await DocumentQueryModel.findAll({
    where: { cxId, patientId, ...(requestId ? { requestId } : {}), isReconvert: false },
    order: [["createdAt", "DESC"]],
  });
  if (existing.length < 1) return undefined;
  return createGlobalDocumentQueryProgress({ docQuery: existing[0].dataValues });
}

export async function getDocumentQueryProgressesToUpdate(patientIds?: string[]): Promise<
  {
    commonwell: DocumentQueryProgress;
    carequality: DocumentQueryProgress;
    unknown: DocumentQueryProgress;
    cxId: string;
    patientId: string;
    requestId: string;
  }[]
> {
  const now = buildDayjs();
  const docQueries = await DocumentQueryModel.findAll({
    where: {
      isReconvert: false,
      ...(patientIds ? { patientId: { [Op.in]: patientIds } } : {}),
      updatedAt: {
        [Op.gt]: now.subtract(MAX_TIME_TO_PROCESS.add(BUFFER_TIME).asMinutes(), "minute").toDate(),
        [Op.lt]: now.subtract(MAX_TIME_TO_PROCESS.asMinutes(), "minute").toDate(),
      },
    },
  });
  return docQueries.map(docQuery => ({
    commonwell: createHieDocumentQueryProgress({
      hie: MedicalDataSource.COMMONWELL,
      docQuery: docQuery.dataValues,
    }),
    carequality: createHieDocumentQueryProgress({
      hie: MedicalDataSource.CAREQUALITY,
      docQuery: docQuery.dataValues,
    }),
    unknown: createHieDocumentQueryProgress({
      hie: "unknown",
      docQuery: docQuery.dataValues,
    }),
    cxId: docQuery.cxId,
    patientId: docQuery.patientId,
    requestId: docQuery.requestId,
  }));
}

export async function updateDocumentQueryProgress({
  cxId,
  patientId,
  requestId,
  source,
  progressType,
}: DocumentQueryLookUpParams & {
  source: DocumentQueryDocumentSource;
  progressType: ProgressType;
}): Promise<DocumentQuery> {
  const existing = await getDocumentQueryModelOrFail({ cxId, patientId, requestId });
  const columnTotal = createColumn({ source, progressType, field: "Total" });
  const columnError = createColumn({ source, progressType, field: "Error" });
  const columnSuccess = createColumn({ source, progressType, field: "Success" });
  const columnStatus = createColumn({ source, progressType, field: "Status" });
  const newTotal = (existing[columnError] as number) + (existing[columnSuccess] as number);
  const updated = await existing.update({ [columnTotal]: newTotal, [columnStatus]: "completed" });
  return updated.dataValues;
}

export function createHieDocumentQueryProgress({
  hie,
  docQuery,
}: {
  hie: MedicalDataSource | "unknown";
  docQuery: DocumentQuery;
}): DocumentQueryProgress {
  const downloadTotal =
    hie === MedicalDataSource.COMMONWELL
      ? docQuery.commonwellDownloadTotal
      : hie === MedicalDataSource.CAREQUALITY
      ? docQuery.carequalityDownloadTotal
      : docQuery.unknownDownloadTotal;
  const downloadSuccessful =
    hie === MedicalDataSource.COMMONWELL
      ? docQuery.commonwellDownloadSuccess
      : hie === MedicalDataSource.CAREQUALITY
      ? docQuery.carequalityDownloadSuccess
      : docQuery.unknownDownloadSuccess;
  const downloadErrors =
    hie === MedicalDataSource.COMMONWELL
      ? docQuery.commonwellDownloadError
      : hie === MedicalDataSource.CAREQUALITY
      ? docQuery.carequalityDownloadError
      : docQuery.unknownDownloadError;
  const convertTotal =
    hie === MedicalDataSource.COMMONWELL
      ? docQuery.commonwellConvertTotal
      : hie === MedicalDataSource.CAREQUALITY
      ? docQuery.carequalityConvertTotal
      : docQuery.unknownConvertTotal;
  const convertSuccessful =
    hie === MedicalDataSource.COMMONWELL
      ? docQuery.commonwellConvertSuccess
      : hie === MedicalDataSource.CAREQUALITY
      ? docQuery.carequalityConvertSuccess
      : docQuery.unknownConvertSuccess;
  const convertErrors =
    hie === MedicalDataSource.COMMONWELL
      ? docQuery.commonwellConvertError
      : hie === MedicalDataSource.CAREQUALITY
      ? docQuery.carequalityConvertError
      : docQuery.unknownConvertError;
  return {
    download: {
      total: downloadTotal,
      successful: downloadSuccessful,
      errors: downloadErrors,
      status: computeStatus(downloadTotal, downloadSuccessful, downloadErrors),
    },
    convert: {
      total: convertTotal,
      successful: convertSuccessful,
      errors: convertErrors,
      status: computeStatus(convertTotal, convertSuccessful, convertErrors),
    },
    requestId: docQuery.requestId,
    startedAt: docQuery.createdAt,
  };
}

export function createGlobalDocumentQueryProgress({
  docQuery,
}: {
  docQuery: DocumentQuery;
}): DocumentQueryProgress {
  const cwDocQueryProgress = createHieDocumentQueryProgress({
    hie: MedicalDataSource.COMMONWELL,
    docQuery,
  });
  const cqDocQueryProgress = createHieDocumentQueryProgress({
    hie: MedicalDataSource.CAREQUALITY,
    docQuery,
  });
  const unknownDocQueryProgress = createHieDocumentQueryProgress({
    hie: "unknown",
    docQuery,
  });
  const downloadTotal =
    (cwDocQueryProgress.download?.total ?? 0) +
    (cqDocQueryProgress.download?.total ?? 0) +
    (unknownDocQueryProgress.download?.total ?? 0);
  const downloadSuccessful =
    (cwDocQueryProgress.download?.successful ?? 0) +
    (cqDocQueryProgress.download?.successful ?? 0) +
    (unknownDocQueryProgress.download?.successful ?? 0);
  const downloadErrors =
    (cwDocQueryProgress.download?.errors ?? 0) +
    (cqDocQueryProgress.download?.errors ?? 0) +
    (unknownDocQueryProgress.download?.errors ?? 0);
  const convertTotal =
    (cwDocQueryProgress.convert?.total ?? 0) +
    (cqDocQueryProgress.convert?.total ?? 0) +
    (unknownDocQueryProgress.convert?.total ?? 0);
  const convertSuccessful =
    (cwDocQueryProgress.convert?.successful ?? 0) +
    (cqDocQueryProgress.convert?.successful ?? 0) +
    (unknownDocQueryProgress.convert?.successful ?? 0);
  const convertErrors =
    (cwDocQueryProgress.convert.errors ?? 0) +
    (cqDocQueryProgress.convert.errors ?? 0) +
    (unknownDocQueryProgress.convert.errors ?? 0);
  return {
    download: {
      total: downloadTotal,
      successful: downloadSuccessful,
      errors: downloadErrors,
      status: computeStatus(downloadTotal, downloadSuccessful, downloadErrors),
      webhookSent: docQuery.isDownloadWebhookSent,
    },
    convert: {
      total: convertTotal,
      successful: convertSuccessful,
      errors: convertErrors,
      status: computeStatus(convertTotal, convertSuccessful, convertErrors),
      webhookSent: docQuery.isConvertWebhookSent,
    },
    requestId: docQuery.requestId,
    startedAt: docQuery.createdAt,
  };
}

export function computeStatus(
  total: number,
  successful: number,
  errors: number
): "completed" | "processing" | "failed" {
  if (errors === total) return "failed";
  if (successful + errors === total) return "completed";
  return "processing";
}

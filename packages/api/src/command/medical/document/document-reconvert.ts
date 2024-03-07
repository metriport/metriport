import { DocumentReference } from "@medplum/fhirtypes";
import { resourceTypeForConsolidation } from "@metriport/api-sdk";
import { S3Utils } from "@metriport/core/external/aws/s3";
import { executeAsynchronously } from "@metriport/core/util/concurrency";
import { getMetriportContent } from "@metriport/core/external/fhir/shared/extensions/metriport";
import { out } from "@metriport/core/util/log";
import { isMimeTypeXML } from "@metriport/core/util/mime";
import { capture } from "@metriport/core/util/notifications";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { groupBy } from "lodash";
import { DocRefMapping } from "../../../domain/medical/docref-mapping";
import { Patient } from "@metriport/core/domain/patient";
import { convertCDAToFHIR } from "../../../external/fhir-converter/converter";
import { getDocumentsFromFHIR as getDocumentsFromFHIRServer } from "../../../external/fhir/document/get-documents";
import { countResources } from "../../../external/fhir/patient/count-resources";
import { downloadedFromHIEs } from "@metriport/core/external/fhir/shared/index";
import { Config } from "../../../shared/config";
import { errorToString } from "../../../shared/log";
import { formatNumber } from "@metriport/shared/common/numbers";
import { getDocRefMappings } from "../docref-mapping/get-docref-mapping";
import { deleteConsolidated as deleteConsolidatedOnFHIRServer } from "../patient/consolidated-delete";
import { getPatientOrFail } from "../patient/get-patient";
import { setDisableDocumentRequestWHFlag } from "../patient/webhook";
import { docRefContentToFileFunction, SimplerFile } from "./document-query-storage-info";

dayjs.extend(duration);

const patientsToProcessInParallel = 1;
const countResourcesInParallel = 3;

const resourcesToDelete = resourceTypeForConsolidation.filter(r => r !== "DocumentReference");
const s3Utils = new S3Utils(Config.getAWSRegion());

export type ReConvertDocumentsCommand = {
  cxId: string;
  patientIds?: string[];
  documentIds?: string[];
  dateFrom?: string;
  dateTo?: string;
  requestId: string;
  isDisableWH?: boolean;
  dryRun?: boolean;
  logConsolidatedCountBefore?: boolean;
};

type DocumentReferenceWithId = DocumentReference & { id: string };

type DocRefWithS3Info = {
  docRef: DocumentReferenceWithId;
  file: SimplerFile;
};

// TODO 1403 In order to use this consider first implementing the changes on #1403
export const reConvertDocuments = async (params: ReConvertDocumentsCommand): Promise<void> => {
  const startedAt = Date.now();
  const {
    cxId,
    patientIds: patientIdsParam = [],
    documentIds: documentIdsParam = [],
    dateFrom,
    dateTo,
    requestId,
    isDisableWH = true,
    dryRun = false,
    logConsolidatedCountBefore = false,
  } = params;
  const dryRunMsg = getDryRunPrefix(dryRun);
  const { log } = out(`${dryRunMsg}reConvertDocuments - cxId ${cxId}`);
  log(
    `Re-converting documents: ${documentIdsParam.length ?? "all"}, ` +
      `patients: ${patientIdsParam.length ?? "all"}, ` +
      `dateFrom: ${dateFrom}, dateTo: ${dateTo} - ` +
      `docs: ${documentIdsParam.join(", ")}; ` +
      `patients: ${patientIdsParam.join(", ")}`
  );
  try {
    const docRefs = await getDocRefsByCreatedAt(params);
    if (docRefs.length <= 0) {
      log(`No DocumentReferenceMappings found, exiting...`);
      return;
    }

    const docsByPatientId = groupBy(docRefs, d => d.patientId);
    const patientIds = Object.keys(docsByPatientId);

    if (logConsolidatedCountBefore) {
      await countAndLogConsolidated({
        cxId,
        patientIds,
        log,
      });
    }

    const patientPromise = async ([patientId, documents]: [string, DocRefMapping[]]) => {
      const documentIds = documents.map(d => d.id);
      try {
        await reConvertByPatient({
          patient: { id: patientId, cxId },
          documentIds,
          requestId,
          isDisableWH,
          dryRun,
        });
      } catch (error) {
        const msg = `Error re-converting documents for patient`;
        const extra = { error, patientId, documentIds };
        log(`${msg} - ${JSON.stringify(extra)} - ${errorToString(error)}`);
        capture.error(msg, { extra: { ...extra, error } });
      }
    };

    await executeAsynchronously(Object.entries(docsByPatientId), patientPromise, {
      numberOfParallelExecutions: patientsToProcessInParallel,
    });
  } finally {
    const duration = Date.now() - startedAt;
    const durationMin = formatNumber(dayjs.duration(duration).asMinutes());

    log(`Done in ${duration} ms / ${durationMin} min`);
  }
};

async function getDocumentsFromFHIR({
  cxId,
  documentIds,
  log,
}: {
  cxId: string;
  documentIds: string[];
  log: typeof console.log;
}): Promise<DocRefWithS3Info[]> {
  const documentsFromFHIR = await getDocumentsFromFHIRServer({ cxId, documentIds });

  const documentsFromHIEs = documentsFromFHIR.filter(downloadedFromHIEs);

  const docRefWithS3InfoRaw = await Promise.all(documentsFromHIEs.map(addS3InfoToDocRef(log)));
  const documents = docRefWithS3InfoRaw.flatMap(d => d ?? []);

  log(
    `Got ${documentIds.length} from DocRefMappings, ` +
      `${documentsFromFHIR.length} documentsFromFHIR, ` +
      `${documentsFromHIEs.length} documentsFromHIEs, ` +
      `${documents.length} to process`
  );
  return documents;
}

async function reConvertByPatient({
  patient: patientParam,
  documentIds,
  requestId,
  isDisableWH,
  dryRun,
}: {
  patient: Pick<Patient, "id" | "cxId">;
  documentIds: string[];
  requestId: string;
  isDisableWH: boolean;
  dryRun: boolean;
}): Promise<void> {
  const dryRunMsg = getDryRunPrefix(dryRun);
  const { log } = out(`${dryRunMsg}reConvertDocuments - patient ${patientParam.id}`);

  const disableWHAndGetPatient = () =>
    dryRun
      ? getPatientOrFail(patientParam)
      : setDisableDocumentRequestWHFlag({ patient: patientParam, isDisableWH });

  const getDocs = () =>
    getDocumentsFromFHIR({
      cxId: patientParam.cxId,
      documentIds,
      log,
    });

  const [documents, patient] = await Promise.all([getDocs(), disableWHAndGetPatient()]);

  log(`Deleting consolidated data...`);
  const docIds = documents.map(d => d.docRef.id);
  await deleteConsolidatedOnFHIRServer({
    patient,
    resources: resourcesToDelete,
    docIds,
    dryRun,
  });

  await reConvertDocumentsInternal({
    patient,
    documents,
    requestId,
    dryRun,
    log,
  });

  log(`Done for patient`);
}

function addS3InfoToDocRef(log = console.log) {
  return async (doc: DocumentReference): Promise<DocRefWithS3Info | undefined> => {
    const docId = doc.id;
    if (!docId) {
      log(`No id found for docRef, skipping it`);
      return undefined;
    }
    const docRefWithId = { ...doc, id: docId };
    const content = getMetriportContent(docRefWithId);
    if (!content) {
      log(`No Metriport content found for docRef, skipping it - ${docId}`);
      return undefined;
    }
    const file = docRefContentToFileFunction(content);
    if (!file) {
      log(`Could not determine file info for docRef, skipping it - ${docId}`);
      return undefined;
    }
    const s3Info = await s3Utils.getFileInfoFromS3(file.fileName, file.fileLocation);
    if (!isMimeTypeXML(s3Info.contentType)) {
      log(`DocRef's content is not XML, skipping it - ${docId}`);
      return undefined;
    }
    return {
      docRef: docRefWithId,
      file,
    };
  };
}

async function reConvertDocumentsInternal({
  patient,
  documents,
  requestId,
  dryRun,
  log = console.log,
}: {
  patient: Patient;
  documents: DocRefWithS3Info[];
  requestId: string;
  dryRun?: boolean;
  log?: typeof console.log;
}): Promise<void> {
  if (dryRun) {
    log(`[DRY-RUN] Would trigger re-conversion of ${documents.length} doc refs`);
    return;
  }
  const { id: patientId } = patient;

  try {
    log(`Triggering re-conversion of ${documents.length} doc refs...`);

    await executeAsynchronously(documents, async docWithS3Info =>
      reConvertDocument({
        patient,
        docWithS3Info,
        requestId,
      })
    );
  } catch (error) {
    log(`Error processing docs: ${errorToString(error)}`);
    capture.error(error, {
      extra: { context: `processDocsOfPatient`, error, patientId },
    });
  }
}

async function reConvertDocument({
  patient,
  docWithS3Info,
  requestId,
}: {
  patient: Patient;
  docWithS3Info: DocRefWithS3Info;
  requestId: string;
}) {
  const { docRef, file } = docWithS3Info;
  const doc = {
    id: docRef.id,
    content: {
      mimeType: file.fileContentType,
    },
  };
  await convertCDAToFHIR({
    patient,
    document: doc,
    s3FileName: file.fileName,
    s3BucketName: file.fileLocation,
    requestId,
  });
}

async function countAndLogConsolidated({
  cxId,
  patientIds,
  log = console.log,
}: {
  cxId: string;
  patientIds: string[];
  log?: typeof console.log;
}): Promise<Record<string, number>> {
  const consolidatedBeforeMap: Record<string, number> = {};

  const countPatientResources = async (patientId: string) => {
    const resourceCount = await countResources({
      patient: { id: patientId, cxId },
      resources: resourcesToDelete,
    });
    consolidatedBeforeMap[patientId] = resourceCount.total;
  };

  await executeAsynchronously(patientIds, countPatientResources, {
    numberOfParallelExecutions: countResourcesInParallel,
  });

  log(`Consolidated count by patient: ${JSON.stringify(consolidatedBeforeMap)}`);
  return consolidatedBeforeMap;
}

async function getDocRefsByCreatedAt({
  cxId,
  documentIds = [],
  patientIds = [],
  dateFrom,
  dateTo,
}: ReConvertDocumentsCommand) {
  const createdAtRange =
    dateFrom || dateTo
      ? {
          ...(dateFrom ? { from: new Date(dateFrom) } : undefined),
          ...(dateTo ? { to: new Date(dateTo) } : undefined),
        }
      : undefined;
  return getDocRefMappings({
    cxId,
    ids: documentIds,
    patientId: patientIds,
    createdAtRange,
  });
}

function getDryRunPrefix(dryRun?: boolean) {
  return dryRun ? "--DRY-RUN-- " : "";
}

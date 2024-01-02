import { DocumentReference } from "@medplum/fhirtypes";
import { resourceTypeForConsolidation } from "@metriport/api-sdk";
import { S3Utils } from "@metriport/core/external/aws/s3";
import { executeAsynchronously } from "@metriport/core/util/concurrency";
import { out } from "@metriport/core/util/log";
import { isMimeTypeXML } from "@metriport/core/util/mime";
import { capture } from "@metriport/core/util/notifications";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { groupBy } from "lodash";
import { convertCDAToFHIR } from "../../../external/fhir-converter/converter";
import { getDocuments as getDocumentsFromFHIRServer } from "../../../external/fhir/document/get-documents";
import { getPatientId } from "../../../external/fhir/patient";
import { countResources } from "../../../external/fhir/patient/count-resources";
import { downloadedFromHIEs } from "../../../external/fhir/shared";
import { getMetriportContent } from "../../../external/fhir/shared/extensions/metriport";
import { PatientModel as Patient } from "../../../models/medical/patient";
import { Config } from "../../../shared/config";
import { errorToString } from "../../../shared/log";
import { formatNumber } from "../../../shared/numbers";
import { deleteConsolidated as deleteConsolidatedOnFHIRServer } from "../patient/consolidated-delete";
import { getPatientOrFail } from "../patient/get-patient";
import { setDisableDocumentRequestWHFlag } from "../patient/webhook";
import { docRefContentToFileFunction, SimplerFile } from "./document-query-storage-info";

dayjs.extend(duration);

const patientsToProcessInParallel = 1;
const countResourcesInParallel = 3;

const resourcesToDelete = resourceTypeForConsolidation.filter(r => r !== "DocumentReference");
const s3Utils = new S3Utils(Config.getAWSRegion());

const context = "reConvertDocuments";
const MISSING_ID = "missing-id";

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

export const reConvertDocuments = async (params: ReConvertDocumentsCommand): Promise<void> => {
  const startedAt = Date.now();
  const {
    cxId,
    patientIds: patientIdsParam = [],
    documentIds = [],
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
    `Re-converting documents: ${documentIds.length ?? "all"}, ` +
      `patients: ${patientIdsParam.length ?? "all"}, ` +
      `dateFrom: ${dateFrom}, dateTo: ${dateTo} - ` +
      `docs: ${documentIds.join(", ")}; ` +
      `patients: ${patientIdsParam.join(", ")}`
  );
  try {
    const documents = await getDocuments({
      cxId: cxId,
      patientIds: patientIdsParam,
      documentIds,
      dateFrom,
      dateTo,
      log,
    });
    if (documents.length <= 0) {
      log(`No DocumentReference found, exiting...`);
      return;
    }

    const docsByPatientId = groupBy(documents, d => getPatientId(d.docRef) ?? MISSING_ID);
    const patientIds = Object.keys(docsByPatientId);

    if (logConsolidatedCountBefore) {
      await countAndLogConsolidated({
        cxId,
        patientIds,
        log,
      });
    }

    const patientPromise = async ([patientId, documents]: [string, DocRefWithS3Info[]]) => {
      try {
        if (patientId === MISSING_ID) {
          const docIDs = documents.map(d => d.docRef.id);
          const msg = "DocumentReferences with missing patient ID";
          log(`${msg} (${docIDs.length}): ${docIDs.join(", ")}`);
          capture.message(msg, { extra: { docIDs, context }, level: "warning" });
          return;
        }
        await reConvertByPatient({
          patient: { id: patientId, cxId },
          documents,
          requestId,
          isDisableWH,
          dryRun,
        });
      } catch (error) {
        const msg = `Error re-converting documents for patient`;
        const extra = { error, patientId, documentIds };
        log(`${msg} - ${JSON.stringify(extra)} - ${errorToString(error)}`);
        capture.error(`Error re-converting documents for patient`, { extra });
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

async function getDocuments({
  cxId,
  patientIds,
  documentIds,
  dateFrom,
  dateTo,
  log,
}: {
  cxId: string;
  patientIds?: string[];
  documentIds?: string[];
  dateFrom?: string;
  dateTo?: string;
  log: typeof console.log;
}): Promise<DocRefWithS3Info[]> {
  const documentsFromFHIR = await getDocumentsFromFHIRServer({
    cxId: cxId,
    patientId: patientIds,
    documentIds,
    from: dateFrom,
    to: dateTo,
  });
  if (documentsFromFHIR.length <= 0) return [];

  const documentsFromHIEs = documentsFromFHIR.filter(downloadedFromHIEs);

  const docRefWithS3InfoRaw = await Promise.all(documentsFromHIEs.map(addS3InfoToDocRef(log)));
  const docRefWithS3Info = docRefWithS3InfoRaw.flatMap(d => d ?? []);

  const documents = docRefWithS3Info;
  log(
    `Got ${documentsFromFHIR.length} documentsFromFHIR, ` +
      `${documentsFromHIEs.length} documentsFromHIEs, ` +
      `${documents.length} to process`
  );
  return documents;
}

async function reConvertByPatient({
  patient: patientParam,
  documents,
  requestId,
  isDisableWH,
  dryRun,
}: {
  patient: Pick<Patient, "id" | "cxId">;
  documents: DocRefWithS3Info[];
  requestId: string;
  isDisableWH: boolean;
  dryRun?: boolean;
}): Promise<void> {
  const dryRunMsg = getDryRunPrefix(dryRun);
  const { log } = out(`${dryRunMsg}reConvertDocuments - patient ${patientParam.id}`);

  const patient = await getPatientOrFail(patientParam);

  await setDisableDocumentRequestWHFlag({
    patient,
    isDisableWH,
  });
  const docIds = documents.map(d => d.docRef.id);

  log(`Deleting consolidated data...`);
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

function getDryRunPrefix(dryRun?: boolean) {
  return dryRun ? "--DRY-RUN-- " : "";
}

import { DocumentReference } from "@medplum/fhirtypes";
import { resourceTypeForConsolidation } from "@metriport/api-sdk";
import { S3Utils } from "@metriport/core/external/aws/s3";
import { executeAsynchronously } from "@metriport/core/util/concurrency";
import { out } from "@metriport/core/util/log";
import { capture } from "@metriport/core/util/notifications";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { groupBy } from "lodash";
import { DocRefMapping } from "../../../domain/medical/docref-mapping";
import { convertCDAToFHIR } from "../../../external/fhir-converter/converter";
import { getDocuments as getDocumentsFromFHIRServer } from "../../../external/fhir/document/get-documents";
import { countResources } from "../../../external/fhir/patient/count-resources";
import { downloadedFromHIEs } from "../../../external/fhir/shared";
import { getMetriportContent } from "../../../external/fhir/shared/extensions/metriport";
import { PatientModel as Patient } from "../../../models/medical/patient";
import { Config } from "../../../shared/config";
import { errorToString } from "../../../shared/log";
import { formatNumber } from "../../../shared/numbers";
import { getDocRefMappings } from "../docref-mapping/get-docref-mapping";
import { deleteConsolidated as deleteConsolidatedOnFHIRServer } from "../patient/consolidated-delete";
import { getPatientOrFail } from "../patient/get-patient";
import { docRefContentToFileFunction, SimplerFile } from "./document-query-storage-info";

dayjs.extend(duration);

const patientsToProcessInParallel = 1;

const resourcesToDelete = resourceTypeForConsolidation.filter(r => r !== "DocumentReference");
const s3Utils = new S3Utils(Config.getAWSRegion());

export type ReConvertDocumentsCommand = {
  cxId: string;
  patientIds?: string[];
  documentIds?: string[];
  dateFrom?: string;
  dateTo?: string;
  requestId: string;
  logConsolidatedCountBeforeAndAfter?: boolean;
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
    patientIds = [],
    documentIds = [],
    dateFrom,
    dateTo,
    requestId,
    logConsolidatedCountBeforeAndAfter = false,
  } = params;
  const { log } = out(`reConvertDocuments - cxId ${cxId}`);
  log(
    `Re-converting documents: ${documentIds.length ?? "all"}, ` +
      `patients: ${patientIds.length ?? "all"}, ` +
      `dateFrom: ${dateFrom}, dateTo: ${dateTo} - ` +
      `docs: ${documentIds.join(", ")}; ` +
      `patients: ${patientIds.join(", ")}`
  );
  try {
    let consolidatedCountBefore: Record<string, number> | undefined = undefined;
    if (logConsolidatedCountBeforeAndAfter) {
      consolidatedCountBefore = await countAndLogConsolidated({
        cxId,
        patientIds,
        log,
      });
    }

    const docRefs = await getDocRefsByCreatedAt(params);
    if (docRefs.length <= 0) {
      log(`No DocumentReferenceMappings found, exiting...`);
      return;
    }

    const docsByPatientId = groupBy(docRefs, d => d.patientId);

    const patientPromise = async ([patientId, docs]: [string, DocRefMapping[]]) => {
      try {
        const documentIds = docs.map(d => d.id);
        const patient = await getPatientOrFail({ id: patientId, cxId });
        await reConvertByPatient({ patient, documentIds, requestId });
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

    if (consolidatedCountBefore) {
      const consolidatedCountAfter = await countAndLogConsolidated({
        cxId,
        patientIds,
        log,
      });
      compareBeforeAndAfterConsolidated({
        patientIds,
        consolidatedCountBefore,
        consolidatedCountAfter,
        log,
      });
    }
  } finally {
    const duration = Date.now() - startedAt;
    const durationMin = formatNumber(dayjs.duration(duration).asMinutes());

    log(`Done in ${duration} ms / ${durationMin} min`);
  }
};

async function reConvertByPatient({
  patient,
  documentIds,
  requestId,
}: {
  patient: Patient;
  documentIds: string[];
  requestId: string;
}): Promise<void> {
  const { log } = out(`reConvertDocuments - patient ${patient.id}`);

  const documentsFromFHIR = await getDocumentsFromFHIRServer({
    cxId: patient.cxId,
    documentIds,
  });
  // Only use use those we got from HIEs
  const documentsFromHIEs = documentsFromFHIR.filter(downloadedFromHIEs);

  const docRefWithS3InfoRaw = await Promise.all(documentsFromHIEs.map(addS3InfoToDocRef(log)));
  const docRefWithS3Info = docRefWithS3InfoRaw.flatMap(d => d ?? []);

  const documents = docRefWithS3Info;
  log(
    `Got ${documentsFromFHIR.length} documentsFromFHIR, ` +
      `${documentsFromHIEs.length} documentsFromHIEs, ` +
      `${documents.length} to process`
  );
  if (documents.length <= 0) {
    log(`No documents to process, exiting...`);
    return;
  }

  await reConvertFHIRResources({
    patient,
    documents,
    requestId,
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
    if (s3Info.contentType !== "application/xml") {
      log(`DocRef's content is not XML, skipping it - ${docId}`);
      return undefined;
    }
    return {
      docRef: docRefWithId,
      file,
    };
  };
}

async function reConvertFHIRResources({
  patient,
  documents,
  requestId,
  log = console.log,
}: {
  patient: Patient;
  documents: DocRefWithS3Info[];
  requestId: string;
  log?: typeof console.log;
}): Promise<void> {
  const docIds = documents.map(d => d.docRef.id);

  log(`Deleting consolidated data...`);
  await deleteConsolidatedOnFHIRServer({
    patient,
    resources: resourcesToDelete,
    docIds,
  });

  await reConvertDocumentsInternal({
    patient,
    documents,
    requestId,
    log,
  });
}

async function reConvertDocumentsInternal({
  patient,
  documents,
  requestId,
  log = console.log,
}: {
  patient: Patient;
  documents: DocRefWithS3Info[];
  requestId: string;
  log?: typeof console.log;
}): Promise<void> {
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
  for (const patientId of patientIds) {
    const resourceCount = await countResources({
      patient: { id: patientId, cxId },
      resources: resourcesToDelete,
    });
    consolidatedBeforeMap[patientId] = resourceCount.total;
  }
  log(`Consolidated count by patient: ${JSON.stringify(consolidatedBeforeMap)}`);
  return consolidatedBeforeMap;
}

async function compareBeforeAndAfterConsolidated({
  patientIds,
  consolidatedCountBefore,
  consolidatedCountAfter,
  log = console.log,
}: {
  patientIds: string[];
  consolidatedCountBefore: Record<string, number>;
  consolidatedCountAfter: Record<string, number>;
  log?: typeof console.log;
}): Promise<void> {
  const extra: Record<string, unknown> = {};
  const consolidatedCountDiff: Record<string, number> = {};

  for (const patientId of patientIds) {
    const countBefore = consolidatedCountBefore[patientId];
    const countAfter = consolidatedCountAfter[patientId];
    if (countBefore === undefined || countAfter === undefined) {
      log(
        `No consolidated count found for patient ${patientId} ` +
          `(countBefore: ${countBefore}, countAfter: ${countAfter}) - skipping...`
      );
      continue;
    }
    consolidatedCountDiff[patientId] = countAfter - countBefore;
  }
  log(`Consolidated count diff by patient: ${JSON.stringify(consolidatedCountDiff)}`);

  for (const patientId of Object.keys(consolidatedCountDiff)) {
    const diff = consolidatedCountDiff[patientId];
    if (diff == undefined) continue;
    if (diff < 0)
      extra[patientId] = {
        before: consolidatedCountBefore[patientId],
        after: consolidatedCountAfter[patientId],
        diff,
      };
  }
  if (Object.keys(extra).length > 0) {
    const msg = `Unexpected consolidated count after re-convert`;
    log(`${msg} - ${JSON.stringify(extra)}`);
    capture.error(msg, { extra });
  }
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

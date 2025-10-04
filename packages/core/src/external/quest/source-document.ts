import { QuestResponseFile, QuestSourceDocument } from "./types";
import { parseResponseFile } from "./file/file-parser";
import { executeAsynchronously } from "../../util/concurrency";
import { out, LogFunction } from "../../util/log";
import { ResponseDetail } from "./schema/response";
import { IncomingData } from "./schema/shared";
import { QuestReplica } from "./replica";
import { buildSourceDocumentFileName, parseResponseFileName } from "./file/file-names";
import { SOURCE_DOCUMENT_DIRECTORY } from "./replica";
import { SOURCE_DOCUMENT_HEADER } from "./file/constants";

type IncomingRow = IncomingData<ResponseDetail>;
type PatientToIncomingRowMap = Map<string, IncomingRow[]>;

const parallelSourceDocumentUploads = 10;

/**
 * Uploads an array of source documents to an S3 bucket (i.e. an S3 replica that captures SFTP communication).
 */
export async function uploadSourceDocuments(
  replica: QuestReplica,
  sourceDocuments: QuestSourceDocument[]
) {
  const { log, debug } = out("quest.upload-source-docs");
  log(`Uploading ${sourceDocuments.length} source documents to Quest replica`);
  await executeAsynchronously(
    sourceDocuments,
    async sourceDocument => {
      try {
        await replica.uploadSourceDocument(sourceDocument);
      } catch (error) {
        debug(`Error processing source document ${sourceDocument.fileName}: ${error}`);
        throw error;
      }
    },
    {
      numberOfParallelExecutions: parallelSourceDocumentUploads,
      keepExecutingOnError: true,
    }
  );
  log(`Uploaded ${sourceDocuments.length} source documents to Quest replica`);
}

/**
 * Given an array of Quest response files, splits all of them into patient-specific source documents
 * and returns an array of in-memory files that can be uploaded to S3.
 */
export function splitAllResponseFilesIntoSourceDocuments(
  responseFiles: QuestResponseFile[]
): QuestSourceDocument[] {
  const { log } = out("quest.source_docs");
  log(`Generating source documents for ${responseFiles.length} response file(s)`);
  const allSourceDocuments: QuestSourceDocument[] = [];
  for (const responseFile of responseFiles) {
    const sourceDocuments = splitResponseFileIntoSourceDocuments(responseFile);
    allSourceDocuments.push(...sourceDocuments);
  }
  return allSourceDocuments;
}

/**
 * Split a Quest response file into separate source documents for each patient.
 */
export function splitResponseFileIntoSourceDocuments(
  responseFile: QuestResponseFile,
  log?: LogFunction
): QuestSourceDocument[] {
  const rows = parseResponseFile(responseFile.fileContent);
  const rowsGroupedByExternalId = groupRowsByExternalId(rows, log);

  // Create source documents for each patient
  const sourceDocuments: QuestSourceDocument[] = [];
  for (const [externalId, patientRows] of rowsGroupedByExternalId.entries()) {
    const sourceDocument = createSourceDocument({ externalId, patientRows, responseFile });
    sourceDocuments.push(sourceDocument);
  }
  return sourceDocuments;
}

/**
 * Groups a list of incoming rows by the patient ID column.
 */
function groupRowsByExternalId(rows: IncomingRow[], log?: LogFunction): PatientToIncomingRowMap {
  const externalIdRow: PatientToIncomingRowMap = new Map();
  for (const row of rows) {
    const externalId = row.data.externalId;
    if (!externalId) {
      log?.(`Skipping row because it has no external ID`);
      continue;
    }
    if (externalIdRow.has(externalId)) {
      externalIdRow.get(externalId)?.push(row);
    } else {
      externalIdRow.set(externalId, [row]);
    }
  }
  return externalIdRow;
}

/**
 * Creates a source document from a list of incoming rows.
 */
function createSourceDocument({
  externalId,
  patientRows,
  responseFile,
}: {
  externalId: string;
  patientRows: IncomingRow[];
  responseFile: QuestResponseFile;
}): QuestSourceDocument {
  const { dateId } = parseResponseFileName(responseFile.fileName);
  const fileName = buildSourceDocumentFileName({ externalId, dateId });
  const sourceDocumentKey = `${SOURCE_DOCUMENT_DIRECTORY}/${fileName}`;
  const fileContentAsString = patientRows.map(row => row.source).join("\n");
  const fileContent = Buffer.from(SOURCE_DOCUMENT_HEADER + fileContentAsString, "ascii");
  return { fileName, fileContent, externalId, sourceDocumentKey };
}

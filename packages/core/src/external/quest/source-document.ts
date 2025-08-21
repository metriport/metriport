import { QuestResponseFile, QuestPatientResponseFile } from "./types";
import { parseResponseFile } from "./file/file-parser";
import { executeAsynchronously } from "../../util/concurrency";
import { out } from "../../util/log";
import { ResponseDetail } from "./schema/response";
import { IncomingData } from "./schema/shared";
import { QuestReplica } from "./replica";

type IncomingRow = IncomingData<ResponseDetail>;
type PatientToIncomingRowMap = Map<string, IncomingRow[]>;

const parallelSourceDocumentUploads = 10;

/**
 * Uploads an array of source documents to an S3 bucket (i.e. an S3 replica that captures SFTP communication).
 */
export async function uploadSourceDocuments(
  replica: QuestReplica,
  sourceDocuments: QuestPatientResponseFile[]
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
): QuestPatientResponseFile[] {
  const { log } = out("quest.source_docs");
  log(`Generating source documents for ${responseFiles.length} response file(s)`);
  const allSourceDocuments: QuestPatientResponseFile[] = [];
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
  responseFile: QuestResponseFile
): QuestPatientResponseFile[] {
  const rows = parseResponseFile(responseFile.fileContent);
  const rowsGroupedByPatientId = groupRowsByPatientId(rows);

  // Create source documents for each patient
  const sourceDocuments: QuestPatientResponseFile[] = [];
  for (const [patientId, patientRows] of rowsGroupedByPatientId.entries()) {
    const sourceDocument = createSourceDocument({ patientId, patientRows, responseFile });
    sourceDocuments.push(sourceDocument);
  }
  return sourceDocuments;
}

/**
 * Groups a list of incoming rows by the patient ID column.
 */
function groupRowsByPatientId(rows: IncomingRow[]): PatientToIncomingRowMap {
  const patientRow: PatientToIncomingRowMap = new Map();
  for (const row of rows) {
    const patientId = row.data.patientId;
    if (patientRow.has(patientId)) {
      patientRow.get(patientId)?.push(row);
    } else {
      patientRow.set(patientId, [row]);
    }
  }
  return patientRow;
}

/**
 * Creates a source document from a list of incoming rows.
 */
function createSourceDocument({
  patientId,
  patientRows,
  responseFile,
}: {
  patientId: string;
  patientRows: IncomingRow[];
  responseFile: QuestResponseFile;
}): QuestPatientResponseFile {
  const fileName = `${patientId}/${responseFile.fileName}.json`;
  const fileContentAsString = patientRows.map(row => row.source).join("\n");
  const fileContent = Buffer.from(fileContentAsString, "ascii");
  return { fileName, fileContent, patientId };
}

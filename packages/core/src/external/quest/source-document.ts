import { QuestResponseFile, QuestPatientResponseFile } from "./types";
import { parseResponseFile } from "./file/file-parser";
import { ResponseDetail } from "./schema/response";
import { IncomingData } from "./schema/shared";

type IncomingRow = IncomingData<ResponseDetail>;
type PatientToIncomingRowMap = Map<string, IncomingRow[]>;

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

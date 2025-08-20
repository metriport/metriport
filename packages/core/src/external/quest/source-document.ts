import { QuestResponseFile } from "./types";
import { parseResponseFile } from "./file/file-parser";
import { ResponseDetail } from "./schema/response";
import { IncomingData } from "./schema/shared";

type IncomingRow = IncomingData<ResponseDetail>;

export function generateSourceDocuments(responseFile: QuestResponseFile): QuestResponseFile[] {
  const rows = parseResponseFile(responseFile.fileContent);
  const rowsGroupedByPatientId = groupRowsByPatientId(rows);

  // Create source documents for each patient
  const sourceDocuments: QuestResponseFile[] = [];
  for (const [patientId, patientRows] of rowsGroupedByPatientId.entries()) {
    const sourceDocument = createSourceDocument({ patientId, patientRows, responseFile });
    sourceDocuments.push(sourceDocument);
  }
  return sourceDocuments;
}

function groupRowsByPatientId(rows: IncomingRow[]): Map<string, IncomingRow[]> {
  const patientRow: Map<string, IncomingRow[]> = new Map();
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
}): QuestResponseFile {
  const fileName = `${patientId}/${responseFile.fileName}.json`;
  const fileContentAsString = patientRows.map(row => row.source).join("\n");
  const fileContent = Buffer.from(fileContentAsString, "ascii");
  return { fileName, fileContent };
}

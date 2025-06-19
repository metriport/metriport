import { IncomingData } from "../schema/shared";
import { ResponseDetail } from "../schema/response";

export function convertToSourceDocument(details: IncomingData<ResponseDetail>[]): Buffer {
  const rows = details.map(({ source }) => generateSourceDocumentRow(source));
  return Buffer.from(rows.join("\n"), "ascii");
}

function generateSourceDocumentRow(source: string[]): string {
  const escapedCells = source.map(cell => escapePipe(cell));
  return escapedCells.join("|");
}

function escapePipe(cell: string): string {
  return cell.replace(/\|/g, "\\F\\");
}

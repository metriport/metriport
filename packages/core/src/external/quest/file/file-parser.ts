import { MetriportError } from "@metriport/shared";
import {
  IncomingData,
  IncomingFileSchema,
  IncomingFileRowSchema,
  IncomingFile,
} from "../schema/shared";
import { ResponseFile, responseFileSchema } from "../schema/response";

interface RawSpaceDelimitedFile {
  headerRow: string[];
  detailRows: string[][];
  footerRow: string[];
}

export function parseResponseFile(message: Buffer): ResponseFile {
  const pipeDelimitedFile = extractRawPipeDelimitedFile(message);
  const parsedFile = extractIncomingFile(pipeDelimitedFile, responseFileSchema);
  return parsedFile;
}

function extractIncomingFile<H extends object, D extends object, F extends object>(
  rawFile: RawSpaceDelimitedFile,
  schema: IncomingFileSchema<H, D, F>
): IncomingFile<H, D, F> {
  const header = extractIncomingData(rawFile.headerRow, schema.header.row, schema.header.validator);
  const detail = rawFile.detailRows.map(detailRow =>
    extractIncomingData(detailRow, schema.detail.row, schema.detail.validator)
  );
  const footer = extractIncomingData(rawFile.footerRow, schema.footer.row, schema.footer.validator);
  return { header, detail, footer };
}

function extractIncomingData<T extends object>(
  row: string[],
  fieldSchema: IncomingFileRowSchema<T>,
  objectValidator: (data: object) => data is T
): IncomingData<T> {
  const data: Partial<T> = {};
  for (const field of fieldSchema) {
    if (field.key) {
      data[field.key] = field.fromQuest(row[field.field] ?? "");
    }
  }
  if (objectValidator(data)) {
    return { data, source: row };
  } else {
    throw new MetriportError("Invalid row", undefined, {
      data: JSON.stringify(data),
    });
  }
}

function extractRawPipeDelimitedFile(message: Buffer): RawSpaceDelimitedFile {
  const lines = message.toString("ascii").split("\n").filter(nonEmptyLine);

  // TODO: extract from character delimited schema
  const table = lines.map(line => line.split("|"));
  const headerRow = table.shift();
  const detailRows = table.slice(0, -1);
  const footerRow = table.pop();
  if (!headerRow) {
    throw new MetriportError("Header is missing", undefined, {
      message: message.toString("ascii"),
    });
  }
  if (!footerRow) {
    throw new MetriportError("Footer is missing", undefined, {
      message: message.toString("ascii"),
    });
  }
  return { headerRow, detailRows, footerRow };
}

function nonEmptyLine(line: string): boolean {
  return line.trim() !== "";
}

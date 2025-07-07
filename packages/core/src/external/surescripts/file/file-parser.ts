import { MetriportError } from "@metriport/shared";
import {
  IncomingData,
  IncomingFileSchema,
  IncomingFileRowSchema,
  IncomingFile,
} from "../schema/shared";
import { ParsedResponseFile, responseDetailRow, responseFileSchema } from "../schema/response";
import { ParsedVerificationFile, verificationFileSchema } from "../schema/verification";

interface RawPipeDelimitedFile {
  headerRow: string[];
  detailRows: string[][];
  footerRow: string[];
}

export function parseVerificationFile(message: Buffer): ParsedVerificationFile {
  const pipeDelimitedFile = extractRawPipeDelimitedFile(message);
  const parsedFile = extractIncomingFile(pipeDelimitedFile, verificationFileSchema);
  return parsedFile;
}

export function parseResponseFile(message: Buffer): ParsedResponseFile {
  const pipeDelimitedFile = extractRawPipeDelimitedFile(message);
  const parsedFile = extractIncomingFile(pipeDelimitedFile, responseFileSchema);
  return parsedFile;
}

export function parseResponseFileToCsv(message: Buffer): string {
  const pipeDelimitedFile = extractRawPipeDelimitedFile(message);
  const parsedFile = extractIncomingFile(pipeDelimitedFile, responseFileSchema);

  const csv: string[] = [];
  csv.push(
    responseDetailRow.map(column => `"${column && column.key ? column.key : ""}"`).join(",")
  );
  for (const detail of parsedFile.details) {
    csv.push(
      responseDetailRow
        .map(column => {
          if (!column || !column.key) return "";
          const value = detail.data[column.key];
          if (typeof value === "string") return `"${value}"`;
          if (typeof value === "number") return value.toString();
          if (typeof value === "boolean") return value ? "true" : "false";
          if (typeof value === "object") return JSON.stringify(value);
          return "";
        })
        .join(",")
    );
  }
  return csv.join("\n");
}

function extractIncomingFile<H extends object, D extends object, F extends object>(
  rawFile: RawPipeDelimitedFile,
  schema: IncomingFileSchema<H, D, F>
): IncomingFile<H, D, F> {
  const header = extractIncomingData(rawFile.headerRow, schema.header.row, schema.header.validator);
  const details = rawFile.detailRows.map(detailRow =>
    extractIncomingData(detailRow, schema.detail.row, schema.detail.validator)
  );
  const footer = extractIncomingData(rawFile.footerRow, schema.footer.row, schema.footer.validator);
  return { header, details, footer };
}

function extractIncomingData<T extends object>(
  row: string[],
  fieldSchema: IncomingFileRowSchema<T>,
  objectValidator: (data: object) => data is T
): IncomingData<T> {
  const data: Partial<T> = {};
  for (const field of fieldSchema) {
    if (field.key) {
      data[field.key] = field.fromSurescripts(row[field.field] ?? "");
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

function extractRawPipeDelimitedFile(message: Buffer): RawPipeDelimitedFile {
  const lines = message.toString("ascii").split("\n").filter(nonEmptyLine);
  const table = lines.map(line => line.split("|"));
  const headerRow = table[0];
  const detailRows = table.slice(1, table.length - 1);
  const footerRow = table[table.length - 1];
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

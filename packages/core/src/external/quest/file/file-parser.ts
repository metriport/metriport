import { MetriportError } from "@metriport/shared";
import {
  IncomingData,
  IncomingFileSchema,
  IncomingFileRowSchema,
  IncomingFile,
} from "../schema/shared";
import { ResponseDetail, responseDetailRow, responseDetailSchema } from "../schema/response";

const headerMap = Object.fromEntries(
  (responseDetailRow as Array<{ header: string; key: string }>).map(item => [item.header, item.key])
);
const cellParser = Object.fromEntries(
  (responseDetailRow as Array<{ key: string; fromQuest: (value: string) => unknown }>).map(item => [
    item.key,
    item.fromQuest,
  ])
);

export function parseResponseFile(message: Buffer): ResponseDetail[] {
  const details: ResponseDetail[] = [];
  const lines = message
    .toString("ascii")
    .split("\n")
    .filter(line => line.trim() !== "");
  const headerLine = lines.shift();
  if (!headerLine)
    throw new MetriportError("Response file content is missing", undefined, {
      message: message.toString("ascii"),
    });
  const headerRow = headerLine.split("\t");

  for (const line of lines) {
    const row = line.split("\t");
    if (row.length === headerRow.length) {
      const rowObject = Object.fromEntries(
        headerRow.map((header, index) => {
          const key = headerMap[header];
          if (!key) {
            throw new MetriportError("Invalid header", undefined, {
              header,
            });
          }
          const parser = cellParser[key];
          if (!parser) {
            throw new MetriportError("Invalid cell parser", undefined, {
              key,
            });
          }
          const value = parser(row[index]?.trim() ?? "");
          return [key, value];
        })
      );
      const parsed = responseDetailSchema.safeParse(rowObject);
      if (parsed.success) {
        details.push(parsed.data);
      } else {
        console.log(`Invalid row: ${line}`);
        console.log(JSON.stringify(parsed.error, null, 2));
      }
    } else {
      console.log(`Invalid row length: ${line.length} (expected ${headerRow.length})`);
    }
  }
  return details;
}

interface RawSpaceDelimitedFile {
  headerRow: string[];
  detailRows: string[][];
  footerRow: string[];
}

export function extractIncomingFile<H extends object, D extends object, F extends object>(
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

export function extractRawTabDelimitedFile(message: Buffer): RawSpaceDelimitedFile {
  const lines = message.toString("ascii").split("\n").filter(nonEmptyLine);

  // TODO: extract from character delimited schema
  const table = lines.map(line => line.split("\t"));
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

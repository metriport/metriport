import { MetriportError } from "@metriport/shared";
import { ResponseDetail, responseDetailRow, responseDetailSchema } from "../schema/response";
import { IncomingData } from "../schema/shared";

// Maps the Quest response header to the corresponding key in the response detail schema
const headerMap: Record<string, string> = Object.fromEntries(
  (responseDetailRow as Array<{ header: string; key: string }>).map(item => [item.header, item.key])
);

// Parses the value of the cell for the corresponding key in the response detail
const cellParser: Record<string, (value: string) => unknown> = Object.fromEntries(
  (responseDetailRow as Array<{ key: string; fromQuest: (value: string) => unknown }>).map(item => [
    item.key,
    item.fromQuest,
  ])
);

export function parseResponseFile(message: Buffer): IncomingData<ResponseDetail>[] {
  const details: IncomingData<ResponseDetail>[] = [];
  const lines = message
    .toString("ascii")
    .split("\n")
    .filter(line => line.trim() !== "");
  const headerLine = lines.shift();
  if (!headerLine) throw new MetriportError("Response file content is missing");
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
          const value: unknown = parser(row[index]?.trim() ?? "");
          return [key, value];
        })
      );
      const parsed = responseDetailSchema.safeParse(rowObject);
      if (parsed.success) {
        details.push({
          data: parsed.data,
          source: row,
        });
      } else {
        throw new MetriportError("Invalid row in Quest daily update file", undefined, {
          parsedError: JSON.stringify(parsed.error, null, 2),
        });
      }
    } else {
      throw new MetriportError("Invalid row length in Quest daily update file", undefined, {
        rowLength: line.length,
        expectedLength: headerRow.length,
      });
    }
  }
  return details;
}

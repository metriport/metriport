import { MetriportError } from "@metriport/shared";
import { ResponseDetail, responseDetailRow, responseDetailSchema } from "../schema/response";
import { IncomingData } from "../schema/shared";

const headerMap = Object.fromEntries(
  (responseDetailRow as Array<{ header: string; key: string }>).map(item => [item.header, item.key])
);
const cellParser = Object.fromEntries(
  (responseDetailRow as Array<{ key: string; fromQuest: (value: string) => unknown }>).map(item => [
    item.key,
    item.fromQuest,
  ])
);

export function parseResponseFile(
  message: Buffer,
  mapToMetriportId: Record<string, string>
): IncomingData<ResponseDetail>[] {
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
          const value = parser(row[index]?.trim() ?? "");
          return [key, value];
        })
      );
      const parsed = responseDetailSchema.safeParse(rowObject);
      if (parsed.success) {
        const metriportId = mapToMetriportId[parsed.data.patientId];
        if (metriportId) {
          parsed.data.patientId = metriportId;
        } else {
          throw new MetriportError("Unknown patient ID", undefined, {
            patientId: parsed.data.patientId,
            name: parsed.data.patientFirstName + " " + parsed.data.patientLastName,
          });
        }
        details.push({
          data: parsed.data,
          source: row,
        });
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

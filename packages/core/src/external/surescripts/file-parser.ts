import { MetriportError } from "@metriport/shared";
import { IncomingFileRowSchema } from "./schema/shared";

import {
  flatFileHeaderOrder,
  isFlatFileHeader,
  flatFileDetailOrder,
  isFlatFileDetail,
  flatFileFooterOrder,
  isFlatFileFooter,
} from "./schema/response";

import {
  patientVerificationHeaderOrder,
  patientVerificationDetailOrder,
  isPatientVerificationHeader,
  isPatientVerificationDetail,
  patientVerificationFooterOrder,
  isPatientVerificationFooter,
} from "./schema/verification";

export function fromSurescriptsVerificationFile(message: Buffer) {
  const { header, details, footer } = parseTableFromFile(message);

  const headerData = fromSurescriptsRow(
    header,
    patientVerificationHeaderOrder,
    isPatientVerificationHeader
  );
  const detailsData = details.map(detail =>
    fromSurescriptsRow(detail, patientVerificationDetailOrder, isPatientVerificationDetail)
  );
  const footerData = fromSurescriptsRow(
    footer,
    patientVerificationFooterOrder,
    isPatientVerificationFooter
  );

  return { header: headerData, details: detailsData, footer: footerData };
}

export function fromSurescriptsFlatFileResponse(message: Buffer) {
  const { header, details, footer } = parseTableFromFile(message);

  const headerData = fromSurescriptsRow(header, flatFileHeaderOrder, isFlatFileHeader);

  const detailsData = details.map(detail =>
    fromSurescriptsRow(detail, flatFileDetailOrder, isFlatFileDetail)
  );

  const footerData = fromSurescriptsRow(footer, flatFileFooterOrder, isFlatFileFooter);

  return { header: headerData, details: detailsData, footer: footerData };
}

function fromSurescriptsRow<T extends object>(
  row: string[],
  fieldSchema: IncomingFileRowSchema<T>,
  objectValidator: (data: object) => data is T
): T {
  const data: Partial<T> = {};
  for (const field of fieldSchema) {
    if (field.key) {
      data[field.key] = field.fromSurescripts(row[field.field] ?? "");
    }
  }
  if (objectValidator(data)) {
    return data;
  } else {
    throw new MetriportError("Invalid row", undefined, {
      row: row.join("|"),
      data: JSON.stringify(row),
    });
  }
}

function parseTableFromFile(message: Buffer): {
  header: string[];
  details: string[][];
  footer: string[];
} {
  const lines = message.toString("ascii").split("\n").filter(nonEmptyLine);
  const table = lines.map(line => line.split("|"));
  const header = table.shift();
  const details = table.slice(0, -1);
  const footer = table.pop();
  if (!header)
    throw new MetriportError("Header is missing", undefined, {
      message: message.toString("ascii"),
    });
  if (!footer)
    throw new MetriportError("Footer is missing", undefined, {
      message: message.toString("ascii"),
    });
  return { header, details, footer };
}

function nonEmptyLine(line: string): boolean {
  return line.trim() !== "";
}

import { Config } from "../../util/config";
import { z } from "zod";
import { Patient } from "@metriport/shared/domain/patient";
import { validateNPI } from "@metriport/shared/common/validate-npi";
import { MetriportError } from "@metriport/shared";
import {
  patientLoadHeaderSchema,
  patientLoadHeaderOrder,
  patientLoadDetailSchema,
  patientLoadDetailOrder,
  patientLoadFooterSchema,
  patientLoadFooterOrder,
} from "./schema/load";
import {
  patientVerificationHeaderOrder,
  patientVerificationDetailOrder,
  isPatientVerificationHeader,
  isPatientVerificationDetail,
  patientVerificationFooterOrder,
  isPatientVerificationFooter,
} from "./schema/verification";
import {
  flatFileHeaderOrder,
  isFlatFileHeader,
  flatFileDetailOrder,
  isFlatFileDetail,
  flatFileFooterOrder,
  isFlatFileFooter,
} from "./schema/response";
import { OutgoingFileRowSchema, IncomingFileRowSchema } from "./schema/shared";
import { SurescriptsSftpClient, Transmission } from "./client";
import { makeNameDemographics, makeGenderDemographics } from "./shared";
import { SURESCRIPTS_VERSION } from "./constants";

export function canGeneratePatientLoadFile(
  transmission: Transmission,
  patients: Patient[]
): boolean {
  if (patients.length === 0) return false;
  if (!validateNPI(transmission.npiNumber)) return false;
  return true;
}

export function toSurescriptsPatientLoadFile(
  client: SurescriptsSftpClient,
  transmission: Transmission,
  patients: Patient[]
): { content: Buffer; requestedPatientIds: string[] } {
  const requestedPatientIds: string[] = [];
  const header = toSurescriptsPatientLoadRow(
    {
      recordType: "HDR",
      version: SURESCRIPTS_VERSION,
      usage: client.usage,
      senderId: client.senderId,
      senderPassword: client.senderPassword,
      receiverId: client.receiverId,
      patientPopulationId: transmission.cxId,
      lookBackInMonths: 12,
      transmissionId: transmission.id,
      transmissionDate: new Date(transmission.timestamp),
      transmissionFileType: "PMA",
      transmissionAction: "U",
      fileSchedule: "ADHOC",
    },
    patientLoadHeaderSchema,
    patientLoadHeaderOrder
  );

  const details = patients.flatMap(function (patient, index) {
    const { firstName, middleName, lastName, prefix, suffix } = makeNameDemographics(patient);
    const genderAtBirth = makeGenderDemographics(patient.genderAtBirth);

    const address = Array.isArray(patient.address) ? patient.address[0] : patient.address;
    if (!address) return [];

    try {
      const requestRow = toSurescriptsPatientLoadRow(
        {
          recordType: "PNM",
          recordSequenceNumber: index + 1,
          assigningAuthority: Config.getSystemRootOID(),
          patientId: patient.id,
          lastName,
          firstName,
          middleName,
          prefix,
          suffix,
          addressLine1: address.addressLine1,
          addressLine2: address.addressLine2,
          city: address.city,
          state: address.state,
          zip: address.zip,
          dateOfBirth: patient.dob.replace(/-/g, ""),
          genderAtBirth,
          npiNumber: transmission.npiNumber,
        },
        patientLoadDetailSchema,
        patientLoadDetailOrder
      );
      requestedPatientIds.push(patient.id);
      return [requestRow];
    } catch (error) {
      return [];
    }
  });

  const footer = toSurescriptsPatientLoadRow(
    {
      recordType: "TRL",
      totalRecords: details.length,
    },
    patientLoadFooterSchema,
    patientLoadFooterOrder
  );

  return {
    content: Buffer.concat([header, ...details, footer]),
    requestedPatientIds,
  };
}

export function toSurescriptsPatientLoadRow<T extends object>(
  row: T,
  objectSchema: z.ZodObject<z.ZodRawShape>,
  fieldSchema: OutgoingFileRowSchema<T>
): Buffer {
  const parsed = objectSchema.safeParse(row);
  if (!parsed.success) {
    throw new MetriportError("Invalid data", "to_surescripts_patient_load_row", {
      data: JSON.stringify(row),
      errors: JSON.stringify(parsed.error.issues),
    });
  }
  const fields = fieldSchema.map(field => field.toSurescripts(row));
  const outputRow = fields.join("|") + "\n";
  return Buffer.from(outputRow, "ascii");
}

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
    throw new MetriportError("Invalid row", "from_surescripts_row", {
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
    throw new MetriportError("Header is missing", "parse_table_from_file", {
      message: message.toString("ascii"),
    });
  if (!footer)
    throw new MetriportError("Footer is missing", "parse_table_from_file", {
      message: message.toString("ascii"),
    });
  return { header, details, footer };
}

function nonEmptyLine(line: string): boolean {
  return line.trim() !== "";
}

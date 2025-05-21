import { z } from "zod";
import { Patient } from "../../../domain/patient";

import { SURESCRIPTS_VERSION, METRIPORT_OID } from "./constants";

import {
  patientLoadHeaderSchema,
  patientLoadHeaderOrder,
  patientLoadDetailSchema,
  patientLoadDetailOrder,
  patientLoadFooterSchema,
  patientLoadFooterOrder,
} from "./schema/load";

import {
  FileFieldSchema,
  FileRowValidator,
  FileValidator,
  OutgoingFileRowSchema,
  OutgoingFileSchema,
} from "./schema/shared";
import { SurescriptsSftpClient, Transmission, TransmissionType } from "./client";
import { parseNameDemographics } from "./demographics";

export function canGenerateSurescriptsMessage(
  transmission: Transmission<TransmissionType>,
  patients: Patient[]
): boolean {
  if (patients.length === 0) return false;
  if (transmission.npiNumber == null || transmission.npiNumber.trim().length === 0) return false;
  return true;
}

export function toSurescriptsPatientLoadFile(
  client: SurescriptsSftpClient,
  transmission: Transmission<TransmissionType>,
  patients: Patient[]
): Buffer {
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
      transmissionDate: transmission.date,
      transmissionFileType: "PMA",
      transmissionAction: "U",
      fileSchedule: "ADHOC",
    },
    patientLoadHeaderSchema,
    patientLoadHeaderOrder
  );

  const details = patients
    .map((patient, index) => {
      const { firstName, middleName, lastName, prefix, suffix } = parseNameDemographics(
        patient.data
      );
      const gender = patient.data.genderAtBirth ?? "U";
      const genderAtBirth = gender === "O" ? "U" : gender;

      const address = Array.isArray(patient.data.address)
        ? patient.data.address[0]
        : patient.data.address;
      if (!address) return null;

      return toSurescriptsPatientLoadRow(
        {
          recordType: "PNM",
          recordSequenceNumber: index + 1,
          assigningAuthority: METRIPORT_OID,
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
          dateOfBirth: patient.data.dob.replace(/-/g, ""), // TODO: check order
          genderAtBirth,
          npiNumber: transmission.npiNumber,
        },
        patientLoadDetailSchema,
        patientLoadDetailOrder
      );
    })
    .filter(Boolean) as Buffer[];

  const footer = toSurescriptsPatientLoadRow(
    {
      recordType: "TRL",
      totalRecords: details.length,
    },
    patientLoadFooterSchema,
    patientLoadFooterOrder
  );

  return Buffer.concat([header, ...details, footer]);
}

export function toSurescriptsPatientLoadRow<T extends object>(
  data: T,
  schema: z.ZodObject<z.ZodRawShape>,
  order: OutgoingFileRowSchema<T>
): Buffer {
  if (!schema.safeParse(data).success) throw new Error("Invalid data");
  return Buffer.from(order.map(field => field.toSurescripts(data)).join("|"), "ascii");
}

export function fromSurescriptsFile<H extends object, D extends object, F extends object>(
  message: Buffer,
  schema: OutgoingFileSchema<H, D, F>,
  validator: FileValidator<H, D, F>
) {
  // Split Surescripts message into a 2D array of strings with resolved pipe escape sequence
  const rows = message.toString("ascii").split("\n");

  const table = rows.map(row => row.split("|").map(cell => cell.trim().replace(/\\F\\/g, "|")));
  const header = table.shift();
  const details = table.slice(0, -1);
  const footer = table.pop();

  if (!header) throw new Error("Header is required");
  if (!details) throw new Error("Details are required");
  if (!footer) throw new Error("Footer is required");

  const headerData = parseSurescriptsRow(header, schema.header, validator.header);
  const detailsData = details.map(detail =>
    parseSurescriptsRow(detail, schema.detail, validator.detail)
  );
  const footerData = parseSurescriptsRow(footer, schema.footer, validator.footer);

  return { header: headerData, details: detailsData, footer: footerData };
}

function parseSurescriptsRow<T extends object>(
  row: string[],
  fieldSchema: FileFieldSchema<T>,
  validator: FileRowValidator<T>
): T {
  const data: Partial<T> = {};
  for (const field of fieldSchema) {
    if (field.key) {
      if (field.fromSurescripts) {
        data[field.key] = field.fromSurescripts(row[field.field] ?? "");
      }
    }
  }
  if (validator(data)) {
    return data;
  } else throw new Error("Invalid row");
}

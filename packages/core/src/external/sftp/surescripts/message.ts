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

import { dateToString, FileFieldSchema } from "./schema/shared";
import { SurescriptsSftpClient, Transmission, TransmissionType } from "./client";

export function canGenerateSurescriptsMessage(npiNumber: string, patients: Patient[]): boolean {
  if (patients.length === 0) return false;
  if (npiNumber == null || npiNumber.trim().length === 0) return false;
  return true;
}

export function toSurescriptsMessage(
  client: SurescriptsSftpClient,
  transmission: Transmission<TransmissionType>,
  cxId: string,
  npiNumber: string,
  patients: Patient[]
): Buffer {
  const header = generateSurescriptsRow(
    {
      recordType: "HDR",
      version: SURESCRIPTS_VERSION,
      usage: client.usage,
      senderId: client.senderId,
      senderPassword: client.senderPassword,
      receiverId: client.receiverId,
      patientPopulationId: cxId,
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
      const [firstName, ...middleNames] = patient.data.firstName.split(" ");
      const middleName = middleNames?.join(" ") ?? "";
      const gender = patient.data.genderAtBirth ?? "U";
      const genderAtBirth = gender === "O" ? "U" : gender;

      const address = Array.isArray(patient.data.address)
        ? patient.data.address[0]
        : patient.data.address;
      if (!address) return null;

      return generateSurescriptsRow(
        {
          recordType: "PNM",
          recordSequenceNumber: index + 1,
          assigningAuthority: METRIPORT_OID,
          patientId: patient.id,
          lastName: patient.data.lastName ?? "",
          firstName: firstName ?? "",
          middleName,
          prefix: "",
          suffix: "",
          addressLine1: address.addressLine1 ?? "",
          addressLine2: address.addressLine2 ?? "",
          city: address.city ?? "",
          state: address.state ?? "",
          zip: address.zip ?? "",
          dateOfBirth: patient.data.dob ?? "", // TODO: convert
          genderAtBirth: genderAtBirth,
          npiNumber,
          endMonitoringDate: new Date(), // TODO
        },
        patientLoadDetailSchema,
        patientLoadDetailOrder
      );
    })
    .filter(Boolean) as Buffer[];

  const footer = generateSurescriptsRow(
    {
      recordType: "TRL",
      totalRecords: details.length,
    },
    patientLoadFooterSchema,
    patientLoadFooterOrder
  );

  return Buffer.concat([header, ...details, footer]);
}

export function generateSurescriptsRow<T extends object>(
  data: T,
  schema: z.ZodObject<z.ZodRawShape>,
  order: FileFieldSchema<T>
): Buffer {
  if (!schema.safeParse(data).success) throw new Error("Invalid data");

  const row: string[] = [];
  for (const field of order) {
    if (field.toSurescripts) row.push(field.toSurescripts(data));
    else if (field.key) row.push(valueToSurescriptsString(data, field.key));
  }
  // TODO: apply grapheme clustering to each cell
  return Buffer.from(row.join("|"), "ascii");
}

function valueToSurescriptsString<T extends object>(data: T, key: keyof T): string {
  const value = data[key];
  if (value == null) {
    return "";
  } else if (typeof value === "string") {
    return value;
  } else if (typeof value === "number") {
    return value.toFixed(0);
  } else if (typeof value === "boolean") {
    return value ? "1" : "0";
  } else if (value instanceof Date) {
    return dateToString(value);
  }
  return "";
}

export function splitName(
  firstName: string,
  lastName: string
): {
  firstName: string;
  middleName?: string | undefined;
  lastName: string;
  prefix?: string | undefined;
  suffix?: string | undefined;
} {
  let prefix: string | undefined;
  let suffix: string | undefined;
  let middleName: string | undefined;
  const [firstNameFirstPart, ...firstNameRest] = firstName.split(" ");
  const [lastNameFirstPart, ...lastNameRest] = lastName.split(" ");

  // Simple name like John Doe or Jane Smith
  if (firstNameRest.length === 0 && lastNameRest.length === 0) {
    return { firstName: firstNameFirstPart ?? "", lastName: lastNameFirstPart ?? "" };
  }

  // Check for prefixes and suffixes
  if (firstNameFirstPart?.match(/^(Mr|Mrs|)\./)) {
    prefix = firstNameFirstPart;
    firstName = firstNameRest.shift() ?? "";
  }
  if (lastNameRest.length > 0 && lastNameRest[lastNameRest.length - 1]?.match(/^(Mr|Mrs|)\./)) {
    suffix = lastNameRest.pop() ?? "";
  }

  firstName = firstNameFirstPart ?? "";
  lastName = lastNameFirstPart ?? "";
  return { firstName, middleName, lastName, prefix, suffix };
}

// export function parseSurescriptsFile<
//   Header extends object,
//   Detail extends object,
//   Footer extends object,
// >(
//   message: Buffer,
//   schema: {
//     header: FileFieldSchema<Header>;
//     detail: FileFieldSchema<Detail>;
//     footer: FileFieldSchema<Footer>;
//   },
//   validator: {
//     header: FileRowValidator<Header>;
//     detail: FileRowValidator<Detail>;
//     footer: FileRowValidator<Footer>;
//   }
// ) {
//   // Split Surescripts message into a 2D array of strings with resolved pipe escape sequence
//   const rows = message.toString("ascii").split("\n");

//   const table = rows.map(row => row.split("|").map(cell => cell.trim().replace(/\\F\\/g, "|")));
//   const header = table.shift();
//   const details = table.slice(0, -1);
//   const footer = table.pop();

//   if (!header) throw new Error("Header is required");
//   if (!details) throw new Error("Details are required");
//   if (!footer) throw new Error("Footer is required");

//   const headerData = parseSurescriptsRow(header, schema.header, validator.header);
//   const detailsData = details.map(detail =>
//     parseSurescriptsRow(detail, schema.detail, validator.detail)
//   );
//   const footerData = parseSurescriptsRow(footer, schema.footer, validator.footer);

//   return { header: headerData, details: detailsData, footer: footerData };
// }

// function parseSurescriptsRow<T extends object>(
//   row: string[],
//   fieldSchema: FileFieldSchema<T>,
//   validator: FileRowValidator<T>
// ): T {
//   const data: Partial<T> = {};
//   for (const field of fieldSchema) {
//     if (field.key) {
//       if (field.fromSurescripts) {
//         data[field.key] = field.fromSurescripts(row[field.field] ?? "");
//       }
//     }
//   }
//   if (validator(data)) {
//     return data;
//   } else throw new Error("Invalid row");
// }

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
// import { , patientLoadOrder } from "./schema/verification";
import { FileFieldSchema } from "./schema/shared";
import { SurescriptsSftpClient, Transmission, TransmissionType } from "./client";

export function canGenerateSurescriptsMessage(npiNumber: string, patients: Patient[]): boolean {
  // patients = patients.filter(patient => patientSchema.safeParse(patient).success);
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
    return "date";
  }
  return "";
}

// TODO: test implementation
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

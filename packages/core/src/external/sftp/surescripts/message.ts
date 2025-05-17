import { z } from "zod";
import { Patient } from "@metriport/core/domain/patient";
import { patientSchema } from "@metriport/api-sdk/medical/models/patient";
import { Facility, facilitySchema } from "@metriport/api-sdk/medical/models/facility";

import {} from "@metriport/shared/domain/patient/patient-import/types";

import {
  patientLoadHeaderSchema,
  patientLoadHeaderOrder,
  patientLoadDetailSchema,
  patientLoadDetailOrder,
  patientLoadFooterSchema,
  patientLoadFooterOrder,
} from "./schema/plf";
// import { , patientLoadOrder } from "./schema/verification";
import { FileFieldSchema } from "./schema/shared";
import { SurescriptsSftpClient } from "./sftp";

export function canGenerateSurescriptsMessage(facility: Facility, patients: Patient[]): boolean {
  patients = patients.filter(patient => patientSchema.safeParse(patient).success);
  if (patients.length === 0) return false;

  if (!facilitySchema.safeParse(facility).success) return false;
  return true;
}

export function toSurescriptsMessage(
  client: SurescriptsSftpClient,
  cxId: string,
  facility: Facility,
  patients: Patient[]
): Buffer {
  const header = generateSurescriptsRow(
    {
      recordType: "HDR",
      version: client.version,
      usage: client.usage,
      senderId: client.senderId,
      senderPassword: client.senderPassword,
      receiverId: client.receiverId,
      patientPopulationId: cxId,
      lookBackInMonths: 12,
      transmissionId: "transmissionId",
      transmissionDate: new Date(),
      transmissionFileType: "PAT",
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
          recordType: "PAT",
          recordSequenceNumber: index + 1,
          assigningAuthority: "",
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
          npiNumber: facility.npi,
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

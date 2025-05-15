import { z } from "zod";
import { Patient } from "@metriport/core/domain/patient";
import {
  patientLoadHeaderSchema,
  patientLoadHeaderOrder,
  patientLoadDetailSchema,
  patientLoadDetailOrder,
  //   patientLoadFooterSchema,
  //   patientLoadFooterOrder,
} from "./schema/load";
// import { , patientLoadOrder } from "./schema/verification";
import { FileFieldSchema } from "./schema/shared";
import { SurescriptsSftpClient } from "./sftp";

export function toSurescriptsMessage(
  client: SurescriptsSftpClient,
  cxId: string,
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

  const details = patients.map(patient =>
    generateSurescriptsRow(
      {
        recordType: "PAT",
        recordSequenceNumber: 1,
        assigningAuthority: "",
        patientId: "",
        lastName: patient.data.lastName,
        firstName: patient.data.firstName,
        middleName: "",
        prefix: "",
        suffix: "",
        addressLine1: "",
        addressLine2: "",
        city: "",
        state: "",
        zip: "",
        dateOfBirth: "",
        genderAtBirth: "M",
        npiNumber: "",
        endMonitoringDate: new Date(),
        requestedNotifications: [],
        birthDate: "",
        deathDate: "",
        data: [],
      },
      patientLoadDetailSchema,
      patientLoadDetailOrder
    )
  );

  // const footer = generateSurescriptsRow({
  //     recordType: "TRL",
  //     totalRecords: details.length,
  // }, patientLoadFooterSchema, patientLoadFooterOrder);

  return Buffer.concat([header, ...details]);
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

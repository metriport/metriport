import { Config } from "../../../util/config";
import { z } from "zod";
import { Patient } from "../../../domain/patient";
import { SURESCRIPTS_VERSION } from "./constants";

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

import { validateNPI } from "@metriport/shared/common/validate-npi";

import { OutgoingFileRowSchema, IncomingFileRowSchema } from "./schema/shared";
import { SurescriptsSftpClient, Transmission, TransmissionType } from "./client";
import { makeNameDemographics, makeGenderDemographics } from "./shared";
import { GetPatientResponse } from "../api/shared";

export function canGenerateSurescriptsMessage(
  transmission: Transmission<TransmissionType>,
  patients: Patient[]
): boolean {
  if (patients.length === 0) return false;
  if (!validateNPI(transmission.npiNumber)) return false;
  return true;
}

export function toSurescriptsPatientLoadFile(
  client: SurescriptsSftpClient,
  transmission: Transmission<TransmissionType>,
  patients: GetPatientResponse[]
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
      const { firstName, middleName, lastName, prefix, suffix } = makeNameDemographics(patient);
      const genderAtBirth = makeGenderDemographics(patient.genderAtBirth);

      const address = Array.isArray(patient.address) ? patient.address[0] : patient.address;
      if (!address) return null;

      return toSurescriptsPatientLoadRow(
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
  objectSchema: z.ZodObject<z.ZodRawShape>,
  fieldSchema: OutgoingFileRowSchema<T>
): Buffer {
  const parsed = objectSchema.safeParse(data);
  if (!parsed.success) {
    console.log(parsed.error, parsed.error.issues);
    throw new Error("Invalid data");
  }
  const fields = fieldSchema.map(field => field.toSurescripts(data));
  const outputRow = fields.join("|") + "\n";
  return Buffer.from(outputRow, "ascii");
}

export function fromSurescriptsVerificationFile(message: Buffer) {
  const rows = message
    .toString("ascii")
    .split("\n")
    .map(row => row.split("|").map(cell => cell.trim().replace(/\\F\\/g, "|")));
  const header = rows.shift();
  const details = rows.slice(0, -1);
  const footer = rows.pop();

  if (!header) throw new Error("Header is missing");
  if (!details || details.length === 0) throw new Error("Details are missing");
  if (!footer) throw new Error("Footer is missing");

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
  } else throw new Error("Invalid row");
}

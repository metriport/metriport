import { Config } from "../../../util/config";
import { z } from "zod";
import { MetriportError } from "@metriport/shared";
import {
  makeNameDemographics,
  genderMapperFromDomain,
} from "@metriport/shared/common/demographics";
import {
  patientLoadHeaderSchema,
  patientLoadHeaderOrder,
  patientLoadDetailSchema,
  patientLoadDetailOrder,
  patientLoadFooterSchema,
  patientLoadFooterOrder,
} from "../schema/request";
import { OutgoingFileRowSchema } from "../schema/shared";
import { SurescriptsSftpClient } from "../client";
import { SurescriptsPatientRequestData, SurescriptsBatchRequestData } from "../types";
import { buildDayjsFromId } from "../id-generator";
import { makeResponseFileNamePrefix } from "./file-names";

// Latest Surescripts specification, but responses may be in 2.2 format
const surescriptsVersion = "3.0";

type SurescriptsGender = "M" | "F" | "N" | "U";
const makeGenderDemographics = genderMapperFromDomain<SurescriptsGender>(
  {
    M: "M",
    F: "F",
    O: "N",
    U: "U",
  },
  "U"
);

interface SurescriptsGenerateRequestParams {
  client: SurescriptsSftpClient;
  transmissionId: string;
}
interface SurescriptsGeneratePatientRequestParams
  extends SurescriptsGenerateRequestParams,
    SurescriptsPatientRequestData {}
interface SurescriptsGenerateBatchRequestParams
  extends SurescriptsGenerateRequestParams,
    SurescriptsBatchRequestData {
  populationId?: string; // defaults to facility ID
}

export function generatePatientRequestFile({
  client,
  transmissionId,
  patient,
  ...requestData
}: SurescriptsGeneratePatientRequestParams): Buffer | undefined {
  const { content, requestedPatientIds } = generateBatchRequestFile({
    client,
    transmissionId,
    populationId: patient.id,
    ...requestData,
    patients: [patient],
  });
  // If the patient demographics were incomplete (e.g. no address)
  if (requestedPatientIds.length === 0) {
    return undefined;
  }
  return content;
}

export function generateBatchRequestFile({
  client,
  transmissionId,
  populationId,
  facility,
  patients,
}: SurescriptsGenerateBatchRequestParams): {
  content: Buffer | undefined;
  requestedPatientIds: string[];
} {
  const requestedPatientIds: string[] = [];
  const transmissionDate = buildDayjsFromId(transmissionId).toDate();
  const responseFileNamePrefix = makeResponseFileNamePrefix(
    transmissionId,
    populationId ?? facility.id
  );

  const header = toSurescriptsPatientLoadRow(
    {
      recordType: "HDR",
      version: surescriptsVersion,
      usage: client.usage,
      senderId: client.senderId,
      senderPassword: client.senderPassword,
      receiverId: client.receiverId,
      patientPopulationId: responseFileNamePrefix,
      lookBackInMonths: 12,
      transmissionId,
      transmissionDate,
      transmissionFileType: "PMA",
      transmissionAction: "U",
      fileSchedule: "ADHOC",
      extractDate: transmissionDate,
    },
    patientLoadHeaderSchema,
    patientLoadHeaderOrder
  );

  const details = patients.flatMap(function (patient, index) {
    const { firstName, middleName, lastName, prefix, suffix } = makeNameDemographics(patient);
    const genderAtBirth = makeGenderDemographics(patient.genderAtBirth);
    const dateOfBirth = patient.dob.replace(/-/g, "");

    const address = Array.isArray(patient.address) ? patient.address[0] : patient.address;
    if (!address) return [];

    try {
      const requestRow = toSurescriptsPatientLoadRow(
        {
          recordType: "PNM",
          recordSequenceNumber: index + 1,
          assigningAuthority: Config.getSystemRootOID(),
          npiNumber: facility.npi,
          patientId: patient.id,
          lastName,
          firstName,
          middleName,
          prefix,
          suffix,
          dateOfBirth,
          genderAtBirth,
          addressLine1: address.addressLine1,
          addressLine2: address.addressLine2,
          city: address.city,
          state: address.state,
          zip: address.zip,
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
    content:
      requestedPatientIds.length > 0 ? Buffer.concat([header, ...details, footer]) : undefined,
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
    throw new MetriportError("Invalid data", undefined, {
      data: JSON.stringify(row),
      errors: JSON.stringify(parsed.error.issues),
    });
  }
  const fields = fieldSchema.map(field => field.toSurescripts(row));
  const outputRow = fields.join("|") + "\n";
  return Buffer.from(outputRow, "ascii");
}

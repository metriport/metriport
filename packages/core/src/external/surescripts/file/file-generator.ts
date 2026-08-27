import { errorToString, MetriportError } from "@metriport/shared";
import {
  genderMapperFromDomain,
  makeNameDemographics,
} from "@metriport/shared/common/demographics";
import { Patient } from "@metriport/shared/domain/patient";
import { z } from "zod";
import { Config } from "../../../util/config";
import { out } from "../../../util/log";
import { SurescriptsSftpClient } from "../client";
import { buildDayjsFromId } from "../id-generator";
import {
  patientLoadDetailOrder,
  patientLoadDetailSchema,
  patientLoadFooterOrder,
  patientLoadFooterSchema,
  patientLoadHeaderOrder,
  patientLoadHeaderSchema,
  PatientLoadDetail,
} from "../schema/request";
import { OutgoingFileRowSchema } from "../schema/shared";
import { SurescriptsBatchRequestData } from "../types";
import { buildResponseFileNamePrefix } from "./file-names";

// Latest Surescripts specification, but responses may be in 2.2 format
const surescriptsVersion = "3.0";

type SurescriptsGender = "M" | "F" | "U";
const makeGenderDemographics = genderMapperFromDomain<SurescriptsGender>(
  {
    M: "M",
    F: "F",
    O: "U",
    U: "U",
  },
  "U"
);

interface SurescriptsGenerateRequestParams {
  client: SurescriptsSftpClient;
  transmissionId: string;
}
interface SurescriptsGenerateBatchRequestParams
  extends SurescriptsGenerateRequestParams,
    SurescriptsBatchRequestData {}

export function generateBatchRequestFile({
  client,
  transmissionId,
  populationId,
  facilityNpiMap,
  patients,
  includeMultipleDemographics,
}: SurescriptsGenerateBatchRequestParams): {
  content: Buffer | undefined;
  requestedPatientIds: string[];
} {
  const { log } = out(
    `ss.generateBatchRequestFile - transmissionId ${transmissionId} populationId ${populationId}`
  );
  const requestedPatientIds: string[] = [];
  const transmissionDate = buildDayjsFromId(transmissionId).toDate();
  const responseFileId = populationId;
  const responseFileNamePrefix = buildResponseFileNamePrefix(transmissionId, responseFileId);

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

    const npiNumber = getNpiNumberForPatient(patient, facilityNpiMap);
    if (!npiNumber) return [];

    const addresses = patient.address;
    if (addresses.length < 1) return [];

    const contacts = patient.contact ?? [];
    const phoneNumbers = contacts.flatMap(c => {
      if (!c || !c.phone) return [];
      return [c.phone];
    });

    const details: PatientLoadDetail[] = [];
    for (const address of addresses) {
      const detailsNoPhone: PatientLoadDetail = {
        recordType: "PNM",
        recordSequenceNumber: index + 1,
        assigningAuthority: Config.getSystemRootOID(),
        npiNumber,
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
      };
      if (phoneNumbers.length < 1) {
        details.push(detailsNoPhone);
        continue;
      }
      for (const phone of phoneNumbers) {
        const detailsWithPhone = { ...detailsNoPhone, primaryPhone: phone };
        details.push(detailsWithPhone);
      }
    }
    const requestRows: Buffer[] = [];
    for (const detail of details) {
      try {
        if (!includeMultipleDemographics && requestedPatientIds.includes(patient.id)) continue;
        const requestRow = toSurescriptsPatientLoadRow(
          detail as PatientLoadDetail,
          patientLoadDetailSchema,
          patientLoadDetailOrder
        );
        requestedPatientIds.push(patient.id);
        requestRows.push(requestRow);
      } catch (error) {
        log(
          `Error generating Surescripts patient load row for patient ${patient.id}: ${errorToString(
            error
          )}`
        );
        continue;
      }
    }
    return requestRows;
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

export function getNpiNumberForPatient(
  patient: Patient,
  facilityNpiMap: Record<string, string>
): string | undefined {
  // Patients are always created into a facility
  const patientFacilityId = patient.facilityIds[0];
  if (!patientFacilityId) return undefined;

  // If there is a mapping of facility IDs to NPI numbers, use that to determine the NPI number
  if (patientFacilityId && facilityNpiMap && facilityNpiMap[patientFacilityId]) {
    return facilityNpiMap[patientFacilityId];
  }
  return undefined;
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

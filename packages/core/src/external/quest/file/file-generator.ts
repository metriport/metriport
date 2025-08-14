import crypto from "crypto";
import { z } from "zod";
import { Patient } from "@metriport/shared/domain/patient";
import { MetriportError } from "@metriport/shared";
import { makeNameDemographics } from "@metriport/shared/common/demographics";
import { makeGenderDemographics } from "../codes";

import { RelationshipToSubscriber } from "../codes";
import {
  requestHeaderRow,
  requestHeaderSchema,
  requestDetailSchema,
  requestDetailRow,
  requestFooterSchema,
  requestFooterRow,
} from "../schema/request";
import { OutgoingFileRowSchema } from "../schema/shared";

interface QuestRequestFile {
  content: Buffer;
  patientIdMap: Record<string, string>;
}

// Builds a 15 character patient ID
function createPatientId(): string {
  const randomSixteenChars = crypto.randomBytes(8).toString("hex");
  return randomSixteenChars.substring(0, 15);
}

export function generateRosterFile(patients: Patient[]): QuestRequestFile {
  const requestedPatientIds: string[] = [];
  const patientIdMap: Record<string, string> = {};

  const header = toQuestRequestRow(
    { recordType: "H", generalMnemonic: "METRIP", fileCreationDate: new Date() },
    requestHeaderSchema,
    requestHeaderRow
  );

  const details = patients.flatMap(patient => {
    // Build a unique patient ID mapping
    let mappedPatientId = createPatientId();
    while (patientIdMap[mappedPatientId]) {
      mappedPatientId = createPatientId();
    }

    // Generate the request row for this patient
    const row = generatePatientRequestRow(patient, mappedPatientId);
    if (row) {
      requestedPatientIds.push(patient.id);
      patientIdMap[patient.id] = mappedPatientId;
      return [row];
    }
    return [];
  });

  const footer = toQuestRequestRow(
    { recordType: "T", totalRecords: requestedPatientIds.length },
    requestFooterSchema,
    requestFooterRow
  );

  return {
    content: Buffer.concat([header, ...details, footer]),
    patientIdMap,
  };
}

function generatePatientRequestRow(patient: Patient, mappedPatientId: string): Buffer | undefined {
  const { firstName, lastName, middleName } = makeNameDemographics(patient);
  const middleInitial = middleName.substring(0, 1);

  const gender = makeGenderDemographics(patient.genderAtBirth);
  const dateOfBirth = patient.dob.replace(/-/g, "");
  const address = patient.address[0];
  if (!address || !address.addressLine1 || !address.city || !address.state || !address.zip)
    return undefined;

  return toQuestRequestRow(
    {
      recordType: "E",
      relationshipCode: RelationshipToSubscriber.Self,
      relationshipToSubscriber: RelationshipToSubscriber.Self,
      patientId: mappedPatientId,
      firstName,
      middleInitial,
      lastName,
      dateOfBirth,
      gender,
      addressLine1: address.addressLine1,
      addressLine2: address.addressLine2,
      city: address.city,
      state: address.state,
      zipCode: address.zip,
      subscriberFirstName: firstName,
      subscriberLastName: lastName,
      programType: "HMO",
      effectiveDate: new Date(Date.now() - 86400000 * 365 * 2),
      expirationDate: "99991231",
    },
    requestDetailSchema,
    requestDetailRow
  );
}

export function toQuestRequestRow<T extends object>(
  row: T,
  objectSchema: z.ZodObject<z.ZodRawShape>,
  rowSchema: OutgoingFileRowSchema<T>
): Buffer {
  const parsed = objectSchema.safeParse(row);
  if (!parsed.success) {
    throw new MetriportError("Invalid data", undefined, {
      data: JSON.stringify(row),
      errors: JSON.stringify(parsed.error.issues),
    });
  }
  const fields = rowSchema.map(field => field.toQuest(row, field.length));
  const outputRow = fields.join("") + "\n";
  return Buffer.from(outputRow, "ascii");
}

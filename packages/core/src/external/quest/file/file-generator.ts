import { z } from "zod";
import { Patient } from "@metriport/shared/domain/patient";
import { MetriportError } from "@metriport/shared";
import { makeNameDemographics } from "@metriport/shared/common/demographics";
import { makeGenderDemographics, RelationshipToSubscriber } from "../codes";
import {
  requestHeaderRow,
  requestHeaderSchema,
  requestDetailSchema,
  requestDetailRow,
  requestFooterSchema,
  requestFooterRow,
} from "../schema/request";
import { OutgoingFileRowSchema } from "../schema/shared";

export function buildRosterFile(patients: Patient[]): Buffer {
  const header = buildRosterHeader();
  const { body, requestedPatientIds } = buildRosterTable(patients);
  const footer = buildRosterFooter(requestedPatientIds);
  return Buffer.concat([header, body, footer]);
}

function buildRosterHeader(): Buffer {
  return buildQuestRequestRow(
    { recordType: "H", generalMnemonic: "METRIP", fileCreationDate: new Date() },
    requestHeaderSchema,
    requestHeaderRow
  );
}

function buildRosterTable(patients: Patient[]): { body: Buffer; requestedPatientIds: string[] } {
  const requestedPatientIds: string[] = [];
  const rows = patients.flatMap(patient => {
    // Generate the request row for this patient
    const row = buildPatientRow(patient);
    if (row) {
      requestedPatientIds.push(patient.id);
      return [row];
    }
    return [];
  });
  const body = Buffer.concat(rows);
  return { body, requestedPatientIds };
}

function buildPatientRow(patient: Patient): Buffer | undefined {
  if (!patient.externalId) {
    return undefined;
  }
  const { firstName, lastName, middleName } = makeNameDemographics(patient);
  const middleInitial = middleName.substring(0, 1);

  const gender = makeGenderDemographics(patient.genderAtBirth);
  const dateOfBirth = patient.dob.replace(/-/g, "");
  const address = patient.address[0];
  if (!address || !address.addressLine1 || !address.city || !address.state || !address.zip)
    return undefined;

  return buildQuestRequestRow(
    {
      recordType: "E",
      relationshipCode: RelationshipToSubscriber.Self,
      relationshipToSubscriber: RelationshipToSubscriber.Self,
      patientId: patient.externalId,
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

function buildRosterFooter(requestedPatientIds: string[]): Buffer {
  return buildQuestRequestRow(
    { recordType: "T", totalRecords: requestedPatientIds.length },
    requestFooterSchema,
    requestFooterRow
  );
}

export function buildQuestRequestRow<T extends object>(
  row: T,
  objectSchema: z.ZodObject<z.ZodRawShape>,
  rowSchema: OutgoingFileRowSchema<T>
): Buffer {
  const parsed = objectSchema.safeParse(row);
  if (!parsed.success) {
    throw new MetriportError("Invalid data", undefined, {
      errors: JSON.stringify(parsed.error.issues, null, 2),
    });
  }
  const fields = rowSchema.map(field => field.toQuest(row, field.length));
  const outputRow = fields.join("") + "\n";
  return Buffer.from(outputRow, "ascii");
}

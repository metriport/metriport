import { z } from "zod";
import { Patient } from "@metriport/shared/domain/patient";
import { MetriportError } from "@metriport/shared";
import { genderMapperFromDomain } from "@metriport/shared/common/demographics";

import { RelationshipToSubscriber, QuestGenderCode } from "./codes";
import {
  requestHeaderOrder,
  requestHeaderSchema,
  requestDetailSchema,
  requestDetailOrder,
  requestFooterSchema,
  requestFooterOrder,
} from "./schema/request";
import { OutgoingFileRowSchema } from "./schema/shared";

const makeGenderDemographics = genderMapperFromDomain<QuestGenderCode>(
  {
    F: "F",
    M: "M",
    O: "U",
    U: "U",
  },
  "U"
);

export function toQuestRequestFile(patients: Patient[]) {
  const requestedPatientIds: string[] = [];

  const header = toQuestRequestRow(
    { recordType: "H", generalMnemonic: "METRIP", fileCreationDate: new Date() },
    requestHeaderSchema,
    requestHeaderOrder
  );
  const details = patients.flatMap(patient => {
    const row = toQuestRequestPatientRow(patient);
    if (row) {
      requestedPatientIds.push(patient.id);
      return [row];
    }
    return [];
  });
  const footer = toQuestRequestRow(
    { recordType: "T", totalRecords: patients.length },
    requestFooterSchema,
    requestFooterOrder
  );

  return Buffer.concat([header, ...details, footer]);
}

function toQuestRequestPatientRow(patient: Patient): Buffer | undefined {
  const gender = makeGenderDemographics(patient.genderAtBirth);

  const address = patient.address[0];
  if (!address || !address.addressLine1 || !address.city || !address.state || !address.zip)
    return undefined;

  return toQuestRequestRow(
    {
      recordType: "E",
      patientId: patient.id,
      relationshipCode: RelationshipToSubscriber.Self,
      dateOfBirth: patient.dob.replace(/-/g, ""),
      firstName: patient.firstName,
      lastName: patient.lastName,
      gender,
      relationshipToSubscriber: RelationshipToSubscriber.Self,
      addressLine1: address.addressLine1,
      addressLine2: address.addressLine2,
      city: address.city,
      state: address.state,
      zipCode: address.zip,
      subscriberFirstName: patient.firstName,
      subscriberLastName: patient.lastName,
      programType: "01",
      effectiveDate: new Date(),
    },
    requestDetailSchema,
    requestDetailOrder
  );
}

export function toQuestRequestRow<T extends object>(
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
  const fields = fieldSchema.map(field => field.toQuest(row, field.length));
  const outputRow = fields.join("") + "\n";
  return Buffer.from(outputRow, "ascii");
}

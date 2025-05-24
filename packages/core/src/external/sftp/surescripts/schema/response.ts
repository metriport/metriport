import { z } from "zod";
import { DEA_SCHEDULE_CODES, PAYMENT_CODES, PLAN_CODES } from "../codes";

import {
  fromSurescriptsDate,
  fromSurescriptsUtcDate,
  fromSurescriptsEnum,
  fromSurescriptsInteger,
  fromSurescriptsString,
  IncomingFileRowSchema,
  fromSurescriptsUUID,
} from "./shared";

export const flatFileHeaderSchema = z.object({
  recordType: z.enum(["HDR"]),
  version: z.enum(["3.0"]),
  receiverId: z.string(),
  senderId: z.string(),
  populationId: z.string(),
  transmissionId: z.string(),
  sentTime: z.date(),
});

export type FlatFileHeader = z.infer<typeof flatFileHeaderSchema>;

export const flatFileHeaderOrder: IncomingFileRowSchema<FlatFileHeader> = [
  {
    field: 0,
    key: "recordType",
    fromSurescripts: fromSurescriptsEnum(["HDR"]),
  },
  {
    field: 1,
    key: "version",
    fromSurescripts: fromSurescriptsEnum(["3.0"]),
  },
  {
    field: 2,
    key: "receiverId",
    fromSurescripts: fromSurescriptsString(),
  },
  {
    field: 3,
    key: "senderId",
    fromSurescripts: fromSurescriptsString(),
  },
  {
    field: 4,
    key: "populationId",
    fromSurescripts: fromSurescriptsString(),
  },
  {
    field: 5,
    key: "transmissionId",
    fromSurescripts: fromSurescriptsString(),
  },
  {
    field: 6,
    key: "sentTime",
    fromSurescripts: fromSurescriptsUtcDate(),
  },
];

export const flatFileRowSchema = z.object({
  recordType: z.enum(["DTL"]),
  recordSequenceNumber: z.number(),
  messageId: z.string(),
  sentTime: z.date(),
  status: z.string(),
  note: z.string(),
  prescriberNPI: z.string(),
  prescriberName: z.string(),
  patientId: z.string(),
  patientLastName: z.string(),
  patientFirstName: z.string(),
  patientDOB: z.date(),
  patientGender: z.enum(["M", "F", "N", "U"]),
  patientZipCode: z.string(),
  startDate: z.date(),
  endDate: z.date(),
  consent: z.enum(["Y"]),
  drugDescription: z.string().optional(),
  productCode: z.string().optional(),
  productCodeQualifier: z.string().optional(),
  strengthValue: z.string().optional(),
  drugDatabaseCode: z.string().optional(),
  drugDatabaseCodeQualifier: z.string().optional(),
  strengthFormCode: z.string().optional(),
  strengthUnitOfMeasure: z.string().optional(),
  deaSchedule: z.enum(DEA_SCHEDULE_CODES).optional(),
  quantityDispensed: z.string().optional(),
  codeListQualifier: z.string().optional(),
  unitSourceCode: z.string().optional(),
  quantityUnitOfMeasure: z.string().optional(),
  daysSupply: z.string().optional(),
  directions: z.string().optional(),
  refillsRemaining: z.string().optional(),
  substitutions: z.string().optional(),
  dateWritten: z.date().optional(),
  lastFilledDate: z.date().optional(),
  soldDate: z.date().optional(),
  priorAuthorizationNumber: z.string().optional(),
  ncpdpId: z.string().optional(),
  pharmacyNpiNumber: z.string().optional(),
  pharmacyName: z.string().optional(),
  pharmacyAddressLine1: z.string().optional(),
  pharmacyAddressLine2: z.string().optional(),
  pharmacyCity: z.string().optional(),
  pharmacyState: z.string().optional(),
  pharmacyZipCode: z.string().optional(),
  pharmacyPhoneNumber: z.string().optional(),
  pharmacyFaxNumber: z.string().optional(),
  prescriberNpiNumber: z.string().optional(),
  prescriberDeaNumber: z.string().optional(),
  prescriberStateLicenseNumber: z.string().optional(),
  prescriberLastName: z.string().optional(),
  prescriberMiddleName: z.string().optional(),
  prescriberFirstName: z.string().optional(),
  prescriberPrefix: z.string().optional(),
  prescriberSuffix: z.string().optional(),
  prescriberAddressLine1: z.string().optional(),
  prescriberAddressLine2: z.string().optional(),
  prescriberCity: z.string().optional(),
  prescriberState: z.string().optional(),
  prescriberZipCode: z.string().optional(),
  prescriberPhoneNumber: z.string().optional(),
  prescriberFaxNumber: z.string().optional(),
  historySourceQualifier: z.string().optional(),
  fillNumber: z.number().optional(),
  prescriptionNumber: z.string().optional(),
  sourceDescription: z.string().optional(),
  referenceIdValue: z.string().optional(),
  referenceIdQualifier: z.string().optional(),
  rxReferenceNumber: z.string().optional(),
  electronicPrescriptionOrder: z.string().optional(),
  patientPrimaryPhoneNumber: z.string().optional(),
  planCode: z.enum(PLAN_CODES).optional(),
  paymentCode: z.enum(PAYMENT_CODES).optional(),
  planNetworkBIN: z.number().optional(),
  planNetworkPCN: z.string().optional(),
  planNetworkGroupId: z.string().optional(),
  insuranceIdNumber: z.string().optional(),
  sexAssignedAtBirth: z.enum(["M", "F", "U", "I"]).optional(),
  diagnosisDetails: z.string().optional(),
  ndcNumber: z.string().optional(),
});

export type FlatFileRow = z.infer<typeof flatFileRowSchema>;

export const flatFileRowOrder: IncomingFileRowSchema<FlatFileRow> = [
  {
    field: 0,
    key: "recordType",
    fromSurescripts: fromSurescriptsEnum(["DTL"]),
  },
  {
    field: 1,
    key: "recordSequenceNumber",
    fromSurescripts: fromSurescriptsInteger(),
  },
  {
    field: 2,
    key: "messageId",
    fromSurescripts: fromSurescriptsString(),
  },
  {
    field: 3,
    key: "sentTime",
    fromSurescripts: fromSurescriptsUtcDate(),
  },
  {
    field: 4,
    key: "status",
    fromSurescripts: fromSurescriptsString(),
  },
  {
    field: 5,
    key: "note",
    fromSurescripts: fromSurescriptsString(),
  },
  {
    field: 6,
    key: "prescriberNPI",
    fromSurescripts: fromSurescriptsString(),
  },
  {
    field: 7,
    key: "prescriberName",
    fromSurescripts: fromSurescriptsString(),
  },
  {
    field: 8,
    key: "patientId",
    fromSurescripts: fromSurescriptsUUID,
  },
  {
    field: 9,
    key: "patientLastName",
    fromSurescripts: fromSurescriptsString(),
  },
  {
    field: 10,
    key: "patientFirstName",
    fromSurescripts: fromSurescriptsString(),
  },
  {
    field: 11,
    key: "patientDOB",
    fromSurescripts: fromSurescriptsDate(),
  },
  {
    field: 12,
    key: "patientGender",
    fromSurescripts: fromSurescriptsEnum(["M", "F", "N", "U"]),
  },
  {
    field: 13,
    key: "patientZipCode",
    fromSurescripts: fromSurescriptsString(),
  },
  {
    field: 14,
    key: "startDate",
    fromSurescripts: fromSurescriptsDate(),
  },
  {
    field: 15,
    key: "endDate",
    fromSurescripts: fromSurescriptsDate(),
  },
  {
    field: 16,
    key: "consent",
    fromSurescripts: fromSurescriptsEnum(["Y"]),
  },
  {
    field: 17,
    key: "drugDescription",
    fromSurescripts: fromSurescriptsString({ optional: true }),
  },
  {
    field: 18,
    key: "productCode",
    fromSurescripts: fromSurescriptsString({ optional: true }),
  },
  {
    field: 19,
    key: "productCodeQualifier",
    fromSurescripts: fromSurescriptsString({ optional: true }),
  },
  {
    field: 20,
    key: "strengthValue",
    fromSurescripts: fromSurescriptsString({ optional: true }),
  },
  {
    field: 21,
    key: "drugDatabaseCode",
    fromSurescripts: fromSurescriptsString({ optional: true }),
  },
  {
    field: 22,
    key: "drugDatabaseCodeQualifier",
    fromSurescripts: fromSurescriptsString({ optional: true }),
  },
  // Field 23-24 are no longer in use
  {
    field: 25,
    key: "strengthFormCode",
    fromSurescripts: fromSurescriptsString({ optional: true }),
  },
  {
    field: 26,
    key: "strengthUnitOfMeasure",
    fromSurescripts: fromSurescriptsString({ optional: true }),
  },
  {
    field: 27,
    key: "deaSchedule",
    fromSurescripts: fromSurescriptsEnum(DEA_SCHEDULE_CODES, { optional: true }),
  },
  {
    field: 28,
    key: "quantityDispensed",
    fromSurescripts: fromSurescriptsString({ optional: true }),
  },
  {
    field: 29,
    key: "codeListQualifier",
    fromSurescripts: fromSurescriptsString({ optional: true }),
  },
  {
    field: 30,
    key: "unitSourceCode",
    fromSurescripts: fromSurescriptsString({ optional: true }),
  },
  {
    field: 31,
    key: "quantityUnitOfMeasure",
    fromSurescripts: fromSurescriptsString({ optional: true }),
  },
  {
    field: 32,
    key: "daysSupply",
    fromSurescripts: fromSurescriptsString({ optional: true }),
  },
  {
    field: 33,
    key: "directions",
    fromSurescripts: fromSurescriptsString({ optional: true }),
  },
  {
    field: 34,
    key: "refillsRemaining",
    fromSurescripts: fromSurescriptsString({ optional: true }),
  },
  // Field 35 is not in use
  {
    field: 36,
    key: "substitutions",
    fromSurescripts: fromSurescriptsString({ optional: true }),
  },
  {
    field: 37,
    key: "dateWritten",
    fromSurescripts: fromSurescriptsDate({ optional: true }),
  },
  {
    field: 38,
    key: "lastFilledDate",
    fromSurescripts: fromSurescriptsDate({ optional: true }),
  },
  {
    field: 39,
    key: "soldDate",
    fromSurescripts: fromSurescriptsDate({ optional: true }),
  },
  {
    field: 41,
    key: "priorAuthorizationNumber",
    fromSurescripts: fromSurescriptsString({ optional: true }),
  },
  {
    field: 42,
    key: "ncpdpId",
    fromSurescripts: fromSurescriptsString({ optional: true }),
  },
  {
    field: 43,
    key: "pharmacyNpiNumber",
    fromSurescripts: fromSurescriptsString({ optional: true }),
  },
  {
    field: 44,
    key: "pharmacyName",
    fromSurescripts: fromSurescriptsString({ optional: true }),
  },
  {
    field: 45,
    key: "pharmacyAddressLine1",
    fromSurescripts: fromSurescriptsString({ optional: true }),
  },
  {
    field: 46,
    key: "pharmacyAddressLine2",
    fromSurescripts: fromSurescriptsString({ optional: true }),
  },
  {
    field: 47,
    key: "pharmacyCity",
    fromSurescripts: fromSurescriptsString({ optional: true }),
  },
  {
    field: 48,
    key: "pharmacyState",
    fromSurescripts: fromSurescriptsString({ optional: true }),
  },
  {
    field: 49,
    key: "pharmacyZipCode",
    fromSurescripts: fromSurescriptsString({ optional: true }),
  },
  {
    field: 50,
    key: "pharmacyPhoneNumber",
    fromSurescripts: fromSurescriptsString({ optional: true }),
  },
  {
    field: 51,
    key: "pharmacyFaxNumber",
    fromSurescripts: fromSurescriptsString({ optional: true }),
  },
  {
    field: 52,
    key: "prescriberNpiNumber",
    fromSurescripts: fromSurescriptsString({ optional: true }),
  },
  {
    field: 53,
    key: "prescriberDeaNumber",
    fromSurescripts: fromSurescriptsString({ optional: true }),
  },
  {
    field: 54,
    key: "prescriberStateLicenseNumber",
    fromSurescripts: fromSurescriptsString({ optional: true }),
  },
  {
    field: 55,
    key: "prescriberLastName",
    fromSurescripts: fromSurescriptsString({ optional: true }),
  },
  {
    field: 56,
    key: "prescriberMiddleName",
    fromSurescripts: fromSurescriptsString({ optional: true }),
  },
  {
    field: 57,
    key: "prescriberFirstName",
    fromSurescripts: fromSurescriptsString({ optional: true }),
  },
  {
    field: 58,
    key: "prescriberPrefix",
    fromSurescripts: fromSurescriptsString({ optional: true }),
  },
  {
    field: 59,
    key: "prescriberSuffix",
    fromSurescripts: fromSurescriptsString({ optional: true }),
  },
  {
    field: 60,
    key: "prescriberAddressLine1",
    fromSurescripts: fromSurescriptsString({ optional: true }),
  },
  {
    field: 61,
    key: "prescriberAddressLine2",
    fromSurescripts: fromSurescriptsString({ optional: true }),
  },
  {
    field: 62,
    key: "prescriberCity",
    fromSurescripts: fromSurescriptsString({ optional: true }),
  },
  {
    field: 63,
    key: "prescriberState",
    fromSurescripts: fromSurescriptsString({ optional: true }),
  },
  {
    field: 64,
    key: "prescriberZipCode",
    fromSurescripts: fromSurescriptsString({ optional: true }),
  },
  // 65 no longer in use
  {
    field: 66,
    key: "prescriberPhoneNumber",
    fromSurescripts: fromSurescriptsString({ optional: true }),
  },
  {
    field: 67,
    key: "prescriberFaxNumber",
    fromSurescripts: fromSurescriptsString({ optional: true }),
  },
  {
    field: 68,
    key: "historySourceQualifier",
    fromSurescripts: fromSurescriptsString({ optional: true }),
  },
  {
    field: 69,
    key: "fillNumber",
    fromSurescripts: fromSurescriptsInteger({ optional: true }),
  },
  {
    field: 70,
    key: "prescriptionNumber",
    fromSurescripts: fromSurescriptsString({ optional: true }),
  },
  {
    field: 71,
    key: "sourceDescription",
    fromSurescripts: fromSurescriptsString({ optional: true }),
  },
  {
    field: 72,
    key: "referenceIdValue",
    fromSurescripts: fromSurescriptsString({ optional: true }),
  },
  {
    field: 73,
    key: "referenceIdQualifier",
    fromSurescripts: fromSurescriptsString({ optional: true }),
  },
  {
    field: 74,
    key: "rxReferenceNumber",
    fromSurescripts: fromSurescriptsString({ optional: true }),
  },
  {
    field: 75,
    key: "electronicPrescriptionOrder",
    fromSurescripts: fromSurescriptsString({ optional: true }),
  },
  {
    field: 76,
    key: "patientPrimaryPhoneNumber",
    fromSurescripts: fromSurescriptsString({ optional: true }),
  },
  {
    field: 77,
    key: "planCode",
    fromSurescripts: fromSurescriptsEnum(PLAN_CODES, { optional: true }),
  },
  {
    field: 78,
    key: "paymentCode",
    fromSurescripts: fromSurescriptsEnum(PAYMENT_CODES, { optional: true }),
  },
  {
    field: 79,
    key: "planNetworkBIN",
    fromSurescripts: fromSurescriptsInteger({ optional: true }),
  },
  {
    field: 80,
    key: "planNetworkPCN",
    fromSurescripts: fromSurescriptsString({ optional: true }),
  },
  {
    field: 81,
    key: "planNetworkGroupId",
    fromSurescripts: fromSurescriptsString({ optional: true }),
  },
  {
    field: 82,
    key: "insuranceIdNumber",
    fromSurescripts: fromSurescriptsString({ optional: true }),
  },
  {
    field: 83,
    key: "sexAssignedAtBirth",
    fromSurescripts: fromSurescriptsEnum(["M", "F", "U", "I"], { optional: true }),
  },
  {
    field: 84,
    key: "diagnosisDetails",
    fromSurescripts: fromSurescriptsString({ optional: true }),
  },
  {
    field: 85,
    key: "ndcNumber",
    fromSurescripts: fromSurescriptsString({ optional: true }),
  },
  // Surescripts indicates they will add more fields here in the future
];

export const flatFileFooterSchema = z.object({
  recordType: z.enum(["TRL"]),
  processedRecordCount: z.number(),
  medicationCount: z.number().optional(),
  medicationFromPbmCount: z.number().optional(),
  medicationFromPharmacyCount: z.number().optional(),
  patientsFound: z.number().optional(),
  patientsFoundWithLargeHistory: z.number().optional(), // more than 300 medications
  patientsFoundWithIncompleteHistory: z.number().optional(),
  patientsFoundWithNoHistory: z.number().optional(),
  patientsNotFound: z.number().optional(),
  processingErrors: z.number().optional(),
});

type FlatFileFooter = z.infer<typeof flatFileFooterSchema>;

export const flatFileFooterOrder: IncomingFileRowSchema<FlatFileFooter> = [
  {
    field: 0,
    key: "recordType",
    fromSurescripts: fromSurescriptsEnum(["TRL"]),
  },
  {
    field: 1,
    key: "processedRecordCount",
    fromSurescripts: fromSurescriptsInteger(),
  },
  {
    field: 2,
    key: "medicationCount",
    fromSurescripts: fromSurescriptsInteger({ optional: true }),
  },
  {
    field: 3,
    key: "medicationFromPbmCount",
    fromSurescripts: fromSurescriptsInteger({ optional: true }),
  },
  {
    field: 4,
    key: "medicationFromPharmacyCount",
    fromSurescripts: fromSurescriptsInteger({ optional: true }),
  },
  {
    field: 5,
    key: "patientsFound",
    fromSurescripts: fromSurescriptsInteger({ optional: true }),
  },
  {
    field: 6,
    key: "patientsFoundWithIncompleteHistory",
    fromSurescripts: fromSurescriptsInteger({ optional: true }),
  },
  {
    field: 7,
    key: "patientsFoundWithNoHistory",
    fromSurescripts: fromSurescriptsInteger({ optional: true }),
  },
  {
    field: 8,
    key: "patientsNotFound",
    fromSurescripts: fromSurescriptsInteger({ optional: true }),
  },
  {
    field: 9,
    key: "processingErrors",
    fromSurescripts: fromSurescriptsInteger({ optional: true }),
  },
  {
    field: 10,
    key: "patientsFoundWithLargeHistory",
    fromSurescripts: fromSurescriptsInteger({ optional: true }),
  },
];

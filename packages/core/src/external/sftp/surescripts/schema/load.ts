import { z } from "zod";
import {
  FileFieldSchema,
  dateToString,
  toSurescriptsInteger,
  toSurescriptsEnum,
  toSurescriptsString,
  toSurescriptsDate,
  toSurescriptsTime,
} from "./shared";

// PATIENT FILE LOAD
// These are schemas for the first row (header) and subsequent rows (details) of a patient load operation.
export const patientLoadHeaderSchema = z.object({
  recordType: z.literal("HDR"),
  version: z.enum(["2.0", "3.0"]),
  usage: z.enum(["test", "production"]),

  senderId: z.string().length(15),
  senderPassword: z.string().min(1).max(10),
  receiverId: z.string().length(15),
  patientPopulationId: z.string().min(1).max(64),
  lookBackInMonths: z.number().min(1).max(12).optional().default(12),

  transmissionId: z.string().length(10),
  transmissionDate: z.date(),

  // PAT = Patient Notifications and Panel enrollment
  // PNM = Panel enrollment
  // PMA = Patient Notifications enrollment
  transmissionFileType: z.enum(["PAT", "PNM", "PMA"]),
  transmissionAction: z.enum(["U"]).optional(),
  fileSchedule: z.enum(["ADHOC"]).optional(),
  extractDate: z.date().optional(),
});
export type PatientLoadHeader = z.infer<typeof patientLoadHeaderSchema>;

// Describes the order of fields for the first row (header) of a patient load operation.
export const patientLoadHeaderOrder: FileFieldSchema<PatientLoadHeader> = [
  {
    field: 0,
    key: "recordType",
    toSurescripts: toSurescriptsEnum("recordType", ["HDR"]),
  },
  {
    field: 1,
    key: "version",
    toSurescripts: toSurescriptsEnum("version", ["2.0", "3.0"]),
  },
  {
    field: 2,
    key: "senderId",
    toSurescripts: toSurescriptsString("senderId"),
  },
  {
    field: 3,
    key: "senderPassword",
    toSurescripts: toSurescriptsString("senderPassword"),
  },
  {
    field: 4,
    key: "receiverId",
    toSurescripts: toSurescriptsString("receiverId"),
  },
  {
    field: 5,
    key: "transmissionId",
    toSurescripts: toSurescriptsString("transmissionId"),
  },
  {
    field: 6,
    toSurescripts: toSurescriptsDate("transmissionDate"),
  },
  {
    field: 7,
    toSurescripts: toSurescriptsTime("transmissionDate", { centisecond: true }),
  },
  {
    field: 8,
    key: "transmissionFileType",
    toSurescripts: toSurescriptsEnum("transmissionFileType", ["PAT", "PNM", "PMA"]),
  },
  {
    field: 9,
    key: "transmissionAction",
    toSurescripts: toSurescriptsEnum("transmissionAction", ["U"], { optional: true }),
  },
  {
    field: 10,
    key: "extractDate",
    toSurescripts: toSurescriptsDate("extractDate", { optional: true }),
  },
  {
    field: 11,
    key: "usage",
    toSurescripts: toSurescriptsEnum("usage", ["test", "production"]),
  },
  {
    field: 12,
    key: "patientPopulationId",
    toSurescripts: toSurescriptsString("patientPopulationId"),
  },
  {
    field: 13,
    key: "fileSchedule",
    toSurescripts: toSurescriptsEnum("fileSchedule", ["ADHOC"]),
  },
  {
    field: 14,
    key: "lookBackInMonths",
    toSurescripts: toSurescriptsInteger("lookBackInMonths", { optional: true }),
  },
];

// These are the subsequent rows (details) of a patient load operation.
export const patientLoadDetailSchema = z.object({
  recordType: z.enum(["PAT", "PNM", "PMA"]),
  recordSequenceNumber: z.number(),
  assigningAuthority: z.string().min(1).max(64),
  patientId: z.string().min(1).max(35),
  lastName: z.string().min(1).max(35),
  firstName: z.string().min(1).max(35),
  middleName: z.string().min(1).max(35).optional(),
  prefix: z.string().min(1).max(10).optional(),
  suffix: z.string().min(1).max(20).optional(),
  addressLine1: z.string().min(1).max(55).optional(),
  addressLine2: z.string().min(1).max(55).optional(),
  city: z.string().min(2).max(30).optional(),
  state: z.string().min(2).max(55).optional(),
  zip: z.string().min(5).max(10),
  dateOfBirth: z
    .string()
    .length(8)
    .regex(/^\d{8}$/),
  genderAtBirth: z.enum(["M", "F", "U"]),
  npiNumber: z.string().min(1).max(10),
  endMonitoringDate: z.date().optional(),
  requestedNotifications: z
    .array(
      z.enum([
        "PMANewRx",
        "PMARefill",
        "PMANewSubscriber",
        "PMAControlledSubstance",
        "PMANoRefillsRemaining",
        "PMARefillNotPickedUp",
        "PMAInfo",
      ])
    )
    .optional(),
  startDate: z.date().optional(),
  endDate: z.date().optional(),
  primaryPhone: z.string().max(10).optional(),
});

export const patientLoadDetailOrder: FileFieldSchema<PatientLoadDetail> = [
  {
    field: 0,
    key: "recordType",
  },
  {
    field: 1,
    key: "recordSequenceNumber",
  },
  {
    field: 2,
    key: "assigningAuthority",
  },
  {
    field: 3,
    key: "patientId",
  },
  {
    field: 4,
    key: "lastName",
  },
  {
    field: 5,
    key: "firstName",
  },
  {
    field: 6,
    key: "middleName",
  },
  {
    field: 7,
    key: "prefix",
  },
  {
    field: 8,
    key: "suffix",
  },
  {
    field: 9,
    key: "addressLine1",
  },
  {
    field: 10,
    key: "addressLine2",
  },
  {
    field: 11,
    key: "city",
  },
  {
    field: 12,
    key: "state",
  },
  {
    field: 13,
    key: "zip",
  },
  {
    field: 14,
    key: "dateOfBirth",
  },
  {
    field: 15,
    key: "genderAtBirth",
  },
  {
    field: 16,
    key: "npiNumber",
    description:
      "Requester NPI number requesting the MH data, which is validated against the National Provider Identification file to verify that it exists.",
  },
  {
    field: 17,
    key: "endMonitoringDate",
  },
  {
    field: 18,
    key: "requestedNotifications",
  },
  {
    field: 19,
    key: "primaryPhone",
  },
];

export type PatientLoadDetail = z.infer<typeof patientLoadDetailSchema>;

// Patient unload schema (another possible row in a PFL operation)
const patientUnloadSchema = z.object({
  recordType: z.enum(["UNR"]),
  recordSequenceNumber: z.number(),
  product: z.enum(["PMA"]),
  endMonitoringDate: z.date(),
});
export type PatientUnload = z.infer<typeof patientUnloadSchema>;

export const patientUnloadOrder: FileFieldSchema<PatientUnload> = [
  {
    field: 0,
    key: "recordType",
  },
  {
    field: 1,
    key: "recordSequenceNumber",
  },
  {
    field: 2,
    key: "product",
  },
  {
    field: 3,
    key: "endMonitoringDate",
    toSurescripts({ endMonitoringDate }: PatientUnload) {
      return dateToString(endMonitoringDate);
    },
  },
];

export const patientLoadFooterSchema = z.object({
  recordType: z.string().length(3),
  totalRecords: z.number(),
});
export type PatientLoadFooter = z.infer<typeof patientLoadFooterSchema>;

export const patientLoadFooterOrder: FileFieldSchema<PatientLoadFooter> = [
  {
    field: 0,
    key: "recordType",
  },
  {
    field: 1,
    key: "totalRecords",
  },
];

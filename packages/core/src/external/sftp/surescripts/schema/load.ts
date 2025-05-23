import { z } from "zod";
import {
  OutgoingFileRowSchema,
  toSurescriptsInteger,
  toSurescriptsEnum,
  toSurescriptsString,
  toSurescriptsUUID,
  toSurescriptsDate,
  toSurescriptsTime,
  toSurescriptsArray,
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
export const patientLoadHeaderOrder: OutgoingFileRowSchema<PatientLoadHeader> = [
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
  patientId: z.string().min(1).max(36),
  lastName: z.string().min(1).max(36),
  firstName: z.string().min(1).max(36),
  middleName: z.string().max(36).optional(),
  prefix: z.string().max(10).optional(),
  suffix: z.string().max(20).optional(),
  addressLine1: z.string().max(55).optional(),
  addressLine2: z.string().max(55).optional(),
  city: z.string().max(30).optional(),
  state: z.string().max(55).optional(),
  zip: z.string().max(10),
  dateOfBirth: z
    .string()
    .min(8)
    .max(10)
    .regex(/^\d{4}-?\d{2}-?\d{2}$/),
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

export const patientLoadDetailOrder: OutgoingFileRowSchema<PatientLoadDetail> = [
  {
    field: 0,
    key: "recordType",
    toSurescripts: toSurescriptsEnum("recordType", ["PAT", "PNM", "PMA"]),
  },
  {
    field: 1,
    key: "recordSequenceNumber",
    toSurescripts: toSurescriptsInteger("recordSequenceNumber"),
  },
  {
    field: 2,
    key: "assigningAuthority",
    toSurescripts: toSurescriptsString("assigningAuthority"),
  },
  {
    field: 3,
    key: "patientId",
    toSurescripts: ({ patientId }) => toSurescriptsUUID(patientId),
  },
  {
    field: 4,
    key: "lastName",
    toSurescripts: toSurescriptsString("lastName"),
  },
  {
    field: 5,
    key: "firstName",
    toSurescripts: toSurescriptsString("firstName"),
  },
  {
    field: 6,
    key: "middleName",
    toSurescripts: toSurescriptsString("middleName", { optional: true }),
  },
  {
    field: 7,
    key: "prefix",
    toSurescripts: toSurescriptsString("prefix", { optional: true }),
  },
  {
    field: 8,
    key: "suffix",
    toSurescripts: toSurescriptsString("suffix", { optional: true }),
  },
  {
    field: 9,
    key: "addressLine1",
    toSurescripts: toSurescriptsString("addressLine1", { optional: true }),
  },
  {
    field: 10,
    key: "addressLine2",
    toSurescripts: toSurescriptsString("addressLine2", { optional: true }),
  },
  {
    field: 11,
    key: "city",
    toSurescripts: toSurescriptsString("city", { optional: true }),
  },
  {
    field: 12,
    key: "state",
    toSurescripts: toSurescriptsString("state", { optional: true }),
  },
  {
    field: 13,
    key: "zip",
    toSurescripts: toSurescriptsString("zip"),
  },
  {
    field: 14,
    key: "dateOfBirth",
    toSurescripts: toSurescriptsDate("dateOfBirth"),
  },
  {
    field: 15,
    key: "genderAtBirth",
    toSurescripts: toSurescriptsEnum("genderAtBirth", ["M", "F", "U"]),
  },
  {
    field: 16,
    key: "npiNumber",
    toSurescripts: toSurescriptsString("npiNumber"),
  },
  {
    field: 17,
    key: "endMonitoringDate",
    toSurescripts: toSurescriptsDate("endMonitoringDate", { optional: true }),
  },
  {
    field: 18,
    key: "requestedNotifications",
    toSurescripts: toSurescriptsArray(
      "requestedNotifications",
      [
        "PMANewRx",
        "PMARefill",
        "PMANewSubscriber",
        "PMAControlledSubstance",
        "PMANoRefillsRemaining",
        "PMARefillNotPickedUp",
        "PMAInfo",
      ],
      { optional: true }
    ),
  },
  {
    field: 19,
    key: "primaryPhone",
    toSurescripts: toSurescriptsString("primaryPhone", { optional: true }),
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

export const patientUnloadOrder: OutgoingFileRowSchema<PatientUnload> = [
  {
    field: 0,
    key: "recordType",
    toSurescripts: toSurescriptsEnum("recordType", ["UNR"]),
  },
  {
    field: 1,
    key: "recordSequenceNumber",
    toSurescripts: toSurescriptsInteger("recordSequenceNumber"),
  },
  {
    field: 2,
    key: "product",
    toSurescripts: toSurescriptsEnum("product", ["PMA"]),
  },
  {
    field: 3,
    key: "endMonitoringDate",
    toSurescripts: toSurescriptsDate("endMonitoringDate"),
  },
];

export const patientLoadFooterSchema = z.object({
  recordType: z.string().length(3),
  totalRecords: z.number(),
});
export type PatientLoadFooter = z.infer<typeof patientLoadFooterSchema>;

export const patientLoadFooterOrder: OutgoingFileRowSchema<PatientLoadFooter> = [
  {
    field: 0,
    key: "recordType",
    toSurescripts: toSurescriptsEnum("recordType", ["TRL"]),
  },
  {
    field: 1,
    key: "totalRecords",
    toSurescripts: toSurescriptsInteger("totalRecords"),
  },
];

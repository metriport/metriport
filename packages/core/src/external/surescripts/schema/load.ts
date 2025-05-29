import { z } from "zod";
import {
  OutgoingFileRowSchema,
  toSurescriptsInteger,
  toSurescriptsEnum,
  toSurescriptsString,
  toSurescriptsUUID,
  toSurescriptsDate,
  toSurescriptsTime,
} from "./shared";

// The first row of a patient load file
export const patientLoadHeaderSchema = z.object({
  recordType: z.literal("HDR"),
  version: z.enum(["3.0"]),
  usage: z.enum(["T", "P"]),
  senderId: z.string().length(15),
  senderPassword: z.string().min(1).max(10),
  receiverId: z.string().length(15),
  patientPopulationId: z.string().min(1).max(64),
  lookBackInMonths: z.number().min(1).max(12).optional().default(12),
  transmissionId: z.string().length(10),
  transmissionDate: z.date(),
  transmissionFileType: z.enum(["PAT", "PNM", "PMA"]), // PNM = Panel enrollment
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
    toSurescripts: toSurescriptsEnum("version", ["3.0"]),
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
    toSurescripts: toSurescriptsEnum("usage", ["T", "P"]),
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
  lastName: z.string(),
  firstName: z.string(),
  middleName: z.string().optional(),
  prefix: z.string().optional(),
  suffix: z.string().optional(),
  addressLine1: z.string().optional(),
  addressLine2: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zip: z.string(),
  dateOfBirth: z
    .string()
    .min(8)
    .max(10)
    .regex(/^\d{4}-?\d{2}-?\d{2}$/),
  genderAtBirth: z.enum(["M", "F", "N", "U"]), // n - non-binary, u - unknown
  npiNumber: z.string(),
  endMonitoringDate: z.date().optional(),
  primaryPhone: z.string().optional(),
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
    toSurescripts: toSurescriptsString("lastName", { minLength: 2, maxLength: 35, truncate: true }),
  },
  {
    field: 5,
    key: "firstName",
    toSurescripts: toSurescriptsString("firstName", {
      minLength: 2,
      maxLength: 35,
      truncate: true,
    }),
  },
  {
    field: 6,
    key: "middleName",
    toSurescripts: toSurescriptsString("middleName", {
      optional: true,
      minLength: 2,
      maxLength: 35,
      truncate: true,
    }),
  },
  {
    field: 7,
    key: "prefix",
    toSurescripts: toSurescriptsString("prefix", {
      optional: true,
      minLength: 1,
      maxLength: 10,
      truncate: true,
    }),
  },
  {
    field: 8,
    key: "suffix",
    toSurescripts: toSurescriptsString("suffix", {
      optional: true,
      minLength: 1,
      maxLength: 20,
      truncate: true,
    }),
  },
  {
    field: 9,
    key: "addressLine1",
    toSurescripts: toSurescriptsString("addressLine1", {
      optional: true,
      minLength: 1,
      maxLength: 55,
      truncate: true,
    }),
  },
  {
    field: 10,
    key: "addressLine2",
    toSurescripts: toSurescriptsString("addressLine2", {
      optional: true,
      minLength: 1,
      maxLength: 55,
      truncate: true,
    }),
  },
  {
    field: 11,
    key: "city",
    toSurescripts: toSurescriptsString("city", {
      optional: true,
      minLength: 2,
      maxLength: 30,
      truncate: true,
    }),
  },
  {
    field: 12,
    key: "state",
    toSurescripts: toSurescriptsString("state", {
      optional: true,
      minLength: 2,
      maxLength: 55,
      truncate: true,
    }),
  },
  {
    field: 13,
    key: "zip",
    toSurescripts: toSurescriptsString("zip", { minLength: 5, maxLength: 10 }),
  },
  {
    field: 14,
    key: "dateOfBirth",
    toSurescripts: toSurescriptsDate("dateOfBirth"),
  },
  {
    field: 15,
    key: "genderAtBirth",
    toSurescripts: toSurescriptsEnum("genderAtBirth", ["M", "F", "N", "U"]),
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
    field: 19,
    key: "primaryPhone",
    toSurescripts: toSurescriptsString("primaryPhone", { optional: true }),
  },
];

export type PatientLoadDetail = z.infer<typeof patientLoadDetailSchema>;

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

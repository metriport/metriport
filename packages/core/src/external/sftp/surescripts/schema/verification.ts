import { z } from "zod";
import { FileFieldSchema, dateToString, dateToTimeString } from "./shared";

export const patientVerificationHeaderSchema = z.object({
  recordType: z.enum(["SHD"]),
  version: z.enum(["2.0", "3.0"]),
  receiverId: z.string().min(3).max(30),
  senderId: z.string().min(3).max(30),
  transactionControlNumber: z.string().min(1).max(36),
  transactionDate: z.date(),
  transactionFileType: z.enum(["PMA"]),
  transmissionControlNumber: z.string().min(1).max(10), // generated during file load
  transmissionDate: z.date(),
  transmissionTime: z.array(z.number()),
  usage: z.enum(["test", "production"]),
  loadStatus: z.enum(["success", "partial_success", "failure"]),
  loadStatusDescription: z.string().min(1).max(250),
});

export type PatientVerificationHeader = z.infer<typeof patientVerificationHeaderSchema>;

export const patientVerificationHeaderOrder: FileFieldSchema<PatientVerificationHeader> = [
  {
    field: 0,
    key: "recordType",
  },
  {
    field: 1,
    key: "version",
  },
  {
    field: 2,
    key: "receiverId",
  },
  {
    field: 3,
    key: "senderId",
  },
  {
    field: 4,
    key: "transactionControlNumber",
  },
  {
    field: 5,
    toSurescripts({ transactionDate }: PatientVerificationHeader) {
      return dateToString(transactionDate);
    },
  },
  {
    field: 6,
    toSurescripts({ transactionDate }: PatientVerificationHeader) {
      return dateToTimeString(transactionDate, true);
    },
  },
  {
    field: 7,
    key: "transactionFileType",
  },
  {
    field: 8,
    key: "transmissionControlNumber",
  },
  {
    field: 9,
    key: "transmissionDate",
    toSurescripts({ transmissionDate }) {
      return dateToString(transmissionDate);
    },
    fromSurescripts: (value: string) => {
      return new Date(value);
    },
  },
  {
    field: 10,
    toSurescripts({ transmissionDate }) {
      return dateToTimeString(transmissionDate, true);
    },
  },
  {
    field: 11,
    key: "usage",
    fromSurescripts: (value: string) => {
      switch (value) {
        case "T":
          return "test";
        case "P":
          return "production";
        default:
          throw new Error(`Invalid file type: ${value}`);
      }
    },
  },
  {
    field: 12,
    key: "loadStatus",
    fromSurescripts: (value: string) => {
      switch (value) {
        case "01":
          return "success";
        case "02":
          return "partial_success";
        case "03":
          return "failure";
        default:
          throw new Error(`Invalid load status: ${value}`);
      }
    },
  },
  {
    field: 13,
    key: "loadStatusDescription",
  },
];

export const patientVerificationDetailSchema = z.object({
  recordType: z.enum(["SDT"]),
  recordSequenceNumber: z.number(),
  sourceRecordSequenceNumber: z.number().optional(),
  assigningAuthority: z.string().min(1).max(64).optional(),
  patientId: z.string().min(1).max(35),
  errorType: z.enum(["warning", "error", "fatal"]),
  errorCode: z.string().min(1).max(10),
  errorDescription: z.string().min(1).max(250),
});

export type PatientVerificationDetail = z.infer<typeof patientVerificationDetailSchema>;

export const patientVerificationDetailOrder: FileFieldSchema<PatientVerificationDetail> = [
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
    key: "sourceRecordSequenceNumber",
  },
  {
    field: 3,
    key: "assigningAuthority",
  },
  {
    field: 4,
    key: "patientId",
  },
  {
    field: 5,
    key: "errorType",
  },
  {
    field: 6,
    key: "errorCode",
  },
  {
    field: 7,
    key: "errorDescription",
  },
];

export const patientVerificationFooterSchema = z.object({
  recordType: z.enum(["STR"]),
  processedRecords: z.number(),
  errorRecords: z.number().optional(),
  loadedRecords: z.number().optional(),
  totalErrors: z.number().optional(),
});

export type PatientVerificationFooter = z.infer<typeof patientVerificationFooterSchema>;

export const patientVerificationFooterOrder: FileFieldSchema<PatientVerificationFooter> = [
  {
    field: 0,
    key: "recordType",
  },
  {
    field: 1,
    key: "processedRecords",
  },
  {
    field: 2,
    key: "errorRecords",
  },
  {
    field: 3,
    key: "loadedRecords",
  },
  {
    field: 4,
    key: "totalErrors",
  },
];

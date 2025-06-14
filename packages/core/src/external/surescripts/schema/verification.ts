import { z } from "zod";
import {
  IncomingFile,
  IncomingFileRowSchema,
  fromSurescriptsString,
  fromSurescriptsUUID,
  fromSurescriptsDate,
  fromSurescriptsEnum,
  fromSurescriptsTime,
  fromSurescriptsInteger,
  IncomingFileSchema,
} from "./shared";

export type ParsedVerificationFile = IncomingFile<
  VerificationHeader,
  VerificationDetail,
  VerificationFooter
>;

export const verificationHeaderSchema = z.object({
  recordType: z.enum(["SHD"]),
  version: z.string(),
  receiverId: z.string().min(3).max(30),
  senderId: z.string().min(3).max(30),
  transactionId: z.string().min(1).max(36),
  transactionDate: z.date(),
  transactionTime: z.date(),
  transactionFileType: z.enum(["PMA"]),
  transmissionId: z.string().min(1).max(10), // generated during file load
  transmissionDate: z.date(),
  transmissionTime: z.date(),
  usage: z.enum(["T", "P"]),
  // 01 = success, 02 = partial success, 03 = failure
  loadStatus: z.enum(["01", "02", "03"]),
  loadStatusDescription: z.string().min(1).max(250),
});

export type VerificationHeader = z.infer<typeof verificationHeaderSchema>;

export function isVerificationHeader(data: object): data is VerificationHeader {
  return verificationHeaderSchema.safeParse(data).success;
}

export const verificationHeaderRow: IncomingFileRowSchema<VerificationHeader> = [
  {
    field: 0,
    key: "recordType",
    fromSurescripts: fromSurescriptsEnum(["SHD"]),
  },
  {
    field: 1,
    key: "version",
    fromSurescripts: fromSurescriptsString(),
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
    key: "transactionId",
    fromSurescripts: fromSurescriptsString(),
  },
  {
    field: 5,
    key: "transactionDate",
    fromSurescripts: fromSurescriptsDate(),
  },
  {
    field: 6,
    key: "transactionTime",
    fromSurescripts: fromSurescriptsTime(),
  },
  {
    field: 7,
    key: "transactionFileType",
    fromSurescripts: fromSurescriptsEnum(["PMA"]),
  },
  {
    field: 8,
    key: "transmissionId",
    fromSurescripts: fromSurescriptsString(),
  },
  {
    field: 9,
    key: "transmissionDate",
    fromSurescripts: fromSurescriptsDate(),
  },
  {
    field: 10,
    key: "transmissionTime",
    fromSurescripts: fromSurescriptsTime(),
  },
  {
    field: 11,
    key: "usage",
    fromSurescripts: fromSurescriptsEnum(["T", "P"]),
  },
  {
    field: 12,
    key: "loadStatus",
    fromSurescripts: fromSurescriptsEnum(["01", "02", "03"]),
  },
  {
    field: 13,
    key: "loadStatusDescription",
    fromSurescripts: fromSurescriptsString(),
  },
];

export const verificationDetailSchema = z.object({
  recordType: z.enum(["SDT"]),
  recordSequenceNumber: z.number(),
  sourceRecordSequenceNumber: z.number().optional(),
  assigningAuthority: z.string().optional(),
  patientId: z.string().min(1).max(35),
  errorType: z.enum(["W", "E", "F"]), // W = warning, E = error, F = fatal
  errorCode: z.string().optional(),
  errorDescription: z.string().optional(),
});

export type VerificationDetail = z.infer<typeof verificationDetailSchema>;

export function isVerificationDetail(data: object): data is VerificationDetail {
  return verificationDetailSchema.safeParse(data).success;
}

export const verificationDetailOrder: IncomingFileRowSchema<VerificationDetail> = [
  {
    field: 0,
    key: "recordType",
    fromSurescripts: fromSurescriptsEnum(["SDT"]),
  },
  {
    field: 1,
    key: "recordSequenceNumber",
    fromSurescripts: fromSurescriptsInteger(),
  },
  {
    field: 2,
    key: "sourceRecordSequenceNumber",
    fromSurescripts: fromSurescriptsInteger({ optional: true }),
  },
  {
    field: 3,
    key: "assigningAuthority",
    fromSurescripts: fromSurescriptsString({ optional: true }),
  },
  {
    field: 4,
    key: "patientId",
    fromSurescripts: fromSurescriptsUUID,
  },
  {
    field: 5,
    key: "errorType",
    fromSurescripts: fromSurescriptsEnum(["W", "E", "F"]),
  },
  {
    field: 6,
    key: "errorCode",
    fromSurescripts: fromSurescriptsString({ optional: true }),
  },
  {
    field: 7,
    key: "errorDescription",
    fromSurescripts: fromSurescriptsString({ optional: true }),
  },
];

export const verificationFooterSchema = z.object({
  recordType: z.enum(["STR"]),
  processedRecords: z.number(),
  errorRecords: z.number().optional(),
  loadedRecords: z.number().optional(),
  totalErrors: z.number().optional(),
});

export type VerificationFooter = z.infer<typeof verificationFooterSchema>;

export function isVerificationFooter(data: object): data is VerificationFooter {
  return verificationFooterSchema.safeParse(data).success;
}

export const verificationFooterOrder: IncomingFileRowSchema<VerificationFooter> = [
  {
    field: 0,
    key: "recordType",
    fromSurescripts: fromSurescriptsEnum(["STR"]),
  },
  {
    field: 1,
    key: "processedRecords",
    fromSurescripts: fromSurescriptsInteger(),
  },
  {
    field: 2,
    key: "errorRecords",
    fromSurescripts: fromSurescriptsInteger({ optional: true }),
  },
  {
    field: 3,
    key: "loadedRecords",
    fromSurescripts: fromSurescriptsInteger({ optional: true }),
  },
  {
    field: 4,
    key: "totalErrors",
    fromSurescripts: fromSurescriptsInteger({ optional: true }),
  },
];

export const verificationFileSchema: IncomingFileSchema<
  VerificationHeader,
  VerificationDetail,
  VerificationFooter
> = {
  header: {
    row: verificationHeaderRow,
    validator: isVerificationHeader,
  },
  detail: {
    row: verificationDetailOrder,
    validator: isVerificationDetail,
  },
  footer: {
    row: verificationFooterOrder,
    validator: isVerificationFooter,
  },
};

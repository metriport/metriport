import { z } from "zod";
import {
  OutgoingFileRowSchema,
  toQuestEnum,
  toQuestDate,
  toQuestInteger,
  toQuestString,
  toQuestUnused,
} from "./shared";
import { QuestGenderCodes, RelationshipToSubscriberCodes } from "../codes";

export const requestHeaderSchema = z.object({
  recordType: z.enum(["H"]),
  generalMnemonic: z.string(),
  fileCreationDate: z.date(),
});

export type RequestHeader = z.infer<typeof requestHeaderSchema>;

export const requestHeaderOrder: OutgoingFileRowSchema<RequestHeader> = [
  {
    field: 1,
    length: 1,
    key: "recordType",
    toQuest: toQuestEnum("recordType", ["H"]),
  },
  {
    field: 2,
    length: 6,
    key: "generalMnemonic",
    toQuest: toQuestString("generalMnemonic"),
  },
  {
    field: 3,
    length: 8,
    key: "fileCreationDate",
    // TODO: confirm with Quest whether this should be local or UTC date
    toQuest: toQuestDate("fileCreationDate", { useUtc: false }),
  },
  {
    field: 4,
    length: 7,
    toQuest: toQuestUnused(),
  },
  {
    field: 5,
    length: 28,
    toQuest: toQuestUnused(),
  },
  {
    field: 6,
    length: 2,
    toQuest: toQuestUnused(),
  },
  {
    field: 7,
    length: 4,
    toQuest: toQuestUnused(),
  },
  {
    field: 8,
    length: 1,
    toQuest: toQuestUnused(),
  },
  {
    field: 9,
    length: 2,
    toQuest: toQuestUnused(),
  },
  {
    // Original file name
    field: 10,
    length: 60,
    toQuest: toQuestUnused(),
  },
  {
    field: 11,
    length: 307,
    toQuest: toQuestUnused(),
  },
];

export const requestDetailSchema = z.object({
  recordType: z.enum(["E"]), // eligibility record
  patientId: z.string(), // member ID in the specification
  relationshipCode: z.enum(RelationshipToSubscriberCodes),
  ssn: z.string().optional(),
  dateOfBirth: z.string(),
  firstName: z.string(),
  middleInitial: z.string().optional(),
  lastName: z.string(),
  gender: z.enum(QuestGenderCodes),
  relationshipToSubscriber: z.enum(RelationshipToSubscriberCodes),
  programType: z.string(), // MC = HMO, PP = PPO, IN = indemnity
  effectiveDate: z.date(),
  expirationDate: z.date().optional(), // Defaults to 99991231 (open-ended)
  providerId: z.string().optional(),
  employerCode: z.string().optional(),
  divisionNumber: z.string().optional(),
  // TODO: remove some of these fields and replace in schema with toQuestUnused
  planGroup1: z.string().optional(),
  planGroup2: z.string().optional(),
  planGroup3: z.string().optional(),
  groupNumber: z.string().optional(),
  regionCode: z.string().optional(),
  productCode: z.string().optional(),
  medicareId: z.string().optional(),
  medicaidId: z.string().optional(),
  addressLine1: z.string(),
  addressLine2: z.string().optional(),
  city: z.string(),
  state: z.string(),
  zipCode: z.string(),
  subscriberFirstName: z.string(),
  subscriberLastName: z.string(),
  subscriberAreaCode: z.string().optional(),
  subscriberExchange: z.string().optional(),
  subscriberPhoneLastFourDigits: z.string().optional(),
  subscriberExtension: z.string().optional(),
});

export type RequestDetail = z.infer<typeof requestDetailSchema>;

export const requestDetailOrder: OutgoingFileRowSchema<RequestDetail> = [
  {
    field: 1,
    length: 1,
    key: "recordType",
    toQuest: toQuestEnum("recordType", ["E"]),
  },
  {
    field: 2,
    length: 15,
    key: "patientId",
    toQuest: toQuestString("patientId"),
  },
  {
    field: 3,
    length: 3,
    key: "relationshipCode",
    toQuest: toQuestString("relationshipCode"),
  },
  {
    field: 4,
    length: 9,
    key: "ssn",
    toQuest: toQuestString("ssn", { optional: true }),
  },
  {
    field: 5,
    length: 8,
    key: "dateOfBirth",
    toQuest: toQuestString("dateOfBirth"),
  },
  {
    field: 6,
    length: 35,
    key: "lastName",
    toQuest: toQuestString("lastName"),
  },
  {
    field: 7,
    length: 25,
    key: "firstName",
    toQuest: toQuestString("firstName"),
  },
  {
    field: 8,
    length: 1,
    key: "middleInitial",
    toQuest: toQuestString("middleInitial", { optional: true }),
  },
  {
    field: 9,
    length: 1,
    key: "gender",
    toQuest: toQuestEnum("gender", QuestGenderCodes),
  },
  {
    field: 10,
    length: 2,
    key: "relationshipToSubscriber",
    toQuest: toQuestEnum("relationshipToSubscriber", RelationshipToSubscriberCodes),
  },
  {
    field: 11,
    length: 3,
    key: "programType",
    toQuest: toQuestString("programType"),
  },
  {
    field: 12,
    length: 8,
    key: "effectiveDate",
    toQuest: toQuestString("effectiveDate"),
  },
  {
    field: 13,
    length: 8,
    key: "expirationDate",
    toQuest: toQuestString("expirationDate", { optional: true, defaultValue: "99991231" }),
  },
  {
    field: 14,
    length: 15,
    key: "providerId",
    toQuest: toQuestString("providerId", { optional: true }),
  },
  {
    field: 15,
    length: 12,
    key: "employerCode",
    toQuest: toQuestString("employerCode", { optional: true }),
  },
  {
    field: 16,
    length: 10,
    key: "divisionNumber",
    toQuest: toQuestString("divisionNumber", { optional: true }),
  },
  {
    field: 17,
    length: 15,
    key: "planGroup1",
    toQuest: toQuestString("planGroup1", { optional: true }),
  },
  {
    field: 18,
    length: 10,
    key: "planGroup2",
    toQuest: toQuestString("planGroup2", { optional: true }),
  },
  {
    field: 19,
    length: 10,
    key: "planGroup3",
    toQuest: toQuestString("planGroup3", { optional: true }),
  },
  {
    field: 20,
    length: 10,
    key: "groupNumber",
    toQuest: toQuestString("groupNumber", { optional: true }),
  },
  {
    field: 21,
    length: 10,
    key: "regionCode",
    toQuest: toQuestString("regionCode", { optional: true }),
  },
  {
    field: 22,
    length: 10,
    key: "productCode",
    toQuest: toQuestString("productCode", { optional: true }),
  },
  {
    field: 23,
    length: 15,
    key: "medicareId",
    toQuest: toQuestString("medicareId", { optional: true }),
  },
  {
    field: 24,
    length: 15,
    key: "medicaidId",
    toQuest: toQuestString("medicaidId", { optional: true }),
  },
  {
    field: 25,
    length: 30,
    key: "addressLine1",
    toQuest: toQuestString("addressLine1"),
  },
  {
    field: 26,
    length: 30,
    key: "addressLine2",
    toQuest: toQuestString("addressLine2", { optional: true }),
  },
  {
    field: 27,
    length: 25,
    key: "city",
    toQuest: toQuestString("city"),
  },
  {
    field: 28,
    length: 2,
    key: "state",
    toQuest: toQuestString("state"),
  },
  {
    field: 29,
    length: 12,
    key: "zipCode",
    toQuest: toQuestString("zipCode"),
  },
  {
    field: 30,
    length: 25,
    key: "subscriberFirstName",
    toQuest: toQuestString("subscriberFirstName"),
  },
  {
    field: 31,
    length: 35,
    key: "subscriberLastName",
    toQuest: toQuestString("subscriberLastName"),
  },
  {
    field: 32,
    length: 3,
    key: "subscriberAreaCode",
    toQuest: toQuestString("subscriberAreaCode", { optional: true }),
  },
  {
    field: 33,
    length: 3,
    key: "subscriberExchange",
    toQuest: toQuestString("subscriberExchange", { optional: true }),
  },
  {
    field: 34,
    length: 4,
    key: "subscriberPhoneLastFourDigits",
    toQuest: toQuestString("subscriberPhoneLastFourDigits", { optional: true }),
  },
  {
    field: 35,
    length: 6,
    key: "subscriberExtension",
    toQuest: toQuestString("subscriberExtension", { optional: true }),
  },
];

export const requestFooterSchema = z.object({
  recordType: z.enum(["T"]),
  totalRecords: z.number(),
});

export type RequestFooter = z.infer<typeof requestFooterSchema>;

export const requestFooterOrder: OutgoingFileRowSchema<RequestFooter> = [
  {
    field: 1,
    length: 1,
    key: "recordType",
    toQuest: toQuestEnum("recordType", ["T"]),
  },
  {
    field: 2,
    length: 10,
    key: "totalRecords",
    toQuest: toQuestInteger("totalRecords"),
  },
  {
    field: 3,
    length: 415,
    toQuest: toQuestUnused(),
  },
];

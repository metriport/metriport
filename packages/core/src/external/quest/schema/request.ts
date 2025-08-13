import { z } from "zod";
import {
  OutgoingFileRowSchema,
  toQuestEnum,
  toQuestDate,
  toQuestString,
  toQuestUnused,
} from "./shared";

export const requestHeaderSchema = z.object({
  recordType: z.enum(["H"]),
  generalMnemonic: z.string(),
  fileCreationDate: z.date(),
});

export type RequestHeader = z.infer<typeof requestHeaderSchema>;

export const requestHeaderRow: OutgoingFileRowSchema<RequestHeader> = [
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

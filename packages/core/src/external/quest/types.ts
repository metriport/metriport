import { SftpConfig } from "../sftp/types";
import { z } from "zod";

export interface QuestSftpConfig extends Partial<SftpConfig> {
  port?: number;
  local?: boolean;
  localPath?: string;
  replicaBucket?: string;
  replicaBucketRegion?: string;
  outgoingDirectory?: string;
  incomingDirectory?: string;
}

export const questPatientSchema = z.object({
  id: z.string(),
  cxId: z.string(),
  facilityIds: z.array(z.string()),
  data: z.object({
    firstName: z.string(),
    lastName: z.string(),
    dob: z.string(),
    genderAtBirth: z.enum(["M", "F", "O", "U"]),
    address: z.array(
      z.object({
        addressLine1: z.string(),
        addressLine2: z.string().optional(),
        city: z.string(),
        state: z.string(),
        zip: z.string(),
        country: z.string().optional(),
      })
    ),
  }),
});

export type QuestPatient = z.infer<typeof questPatientSchema>;

export const questRosterResponseSchema = z.object({
  patients: z.array(questPatientSchema),
  meta: z.object({
    itemsInTotal: z.number(),
    itemsOnPage: z.number(),
  }),
});

export type QuestRosterResponse = z.infer<typeof questRosterResponseSchema>;

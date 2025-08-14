import { SftpConfig } from "../sftp/types";
import { z } from "zod";
import { patientSchema } from "@metriport/shared/domain/patient";

export interface QuestSftpConfig extends Partial<SftpConfig> {
  port?: number;
  local?: boolean;
  localPath?: string;
  replicaBucket?: string;
  replicaBucketRegion?: string;
  outgoingDirectory?: string;
  incomingDirectory?: string;
}

export const questRosterResponseSchema = z.object({
  patients: z.array(patientSchema),
  meta: z.object({
    itemsInTotal: z.number(),
    itemsOnPage: z.number(),
  }),
});

export type QuestRosterResponse = z.infer<typeof questRosterResponseSchema>;

import { SftpConfig } from "../sftp/types";
import { z } from "zod";
import { patientSchema } from "@metriport/shared/domain/patient";
import { paginationMetaSchema } from "@metriport/shared/domain/pagination";

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
  meta: paginationMetaSchema,
});

export type QuestRosterResponse = z.infer<typeof questRosterResponseSchema>;

export interface QuestResponseFile {
  fileName: string;
  fileContent: Buffer;
}

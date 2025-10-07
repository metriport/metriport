import { Bundle } from "@medplum/fhirtypes";
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

export type QuestRosterType = "notifications" | "backfill";

/**
 * A Quest response file may be prefixed with "Sweep_" or ""
 */
export type QuestResponseType = "notification" | "sweep" | "backfill";

export interface QuestResponseFile {
  fileName: string;
  fileContent: Buffer;
}

export interface QuestSourceDocument extends QuestResponseFile {
  externalId: string;
  sourceDocumentKey: string;
}

export const questFhirConversionRequestSchema = z.object({
  externalId: z.string(),
  sourceDocumentKey: z.string(),
});

export type QuestFhirConversionRequest = z.infer<typeof questFhirConversionRequestSchema>;

export interface QuestFhirConversionResponse {
  bundle: Bundle;
  cxId: string;
  patientId: string;
  dateId: string;
}

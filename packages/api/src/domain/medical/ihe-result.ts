import { z } from "zod";
import { BaseDomainCreate } from "../base-domain";

export interface BaseResultDomain extends BaseDomainCreate {
  requestId: string;
  status: string;
  createdAt: Date;
}

export const issue = z.object({
  severity: z.string(),
  code: z.string(),
  details: z.object({ text: z.string() }),
});

export const operationOutcome = z.object({
  resourceType: z.string(),
  id: z.string(),
  issue: z.array(issue),
});

export const baseResponseSchema = z.object({
  id: z.string(),
  cxId: z.string(),
  timestamp: z.string(),
  responseTimestamp: z.string(),
  xcpdPatientId: z.object({ id: z.string(), system: z.string() }).optional(),
  patientId: z.string(),
  operationOutcome: operationOutcome.nullish(),
});

export const documentReference = z.object({
  homeCommunityId: z.string(),
  docUniqueId: z.string(),
  repositoryUniqueId: z.string(),
  contentType: z.string().nullish(),
  language: z.string().nullish(),
  uri: z.string().nullish(),
  creation: z.string().nullish(),
  title: z.string().nullish(),
});

export type DocumentReference = z.infer<typeof documentReference>;

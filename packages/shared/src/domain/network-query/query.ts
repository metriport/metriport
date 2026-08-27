import { z } from "zod";
import { NetworkSource, networkSourceSchema } from "./source";

export const networkQueryBodySchema = z.object({
  sources: z.array(networkSourceSchema).min(1),
  override: z.boolean().optional(),
  commonwell: z.boolean().optional(),
  carequality: z.boolean().optional(),
  metadata: z.record(z.string().min(1).max(40), z.string().max(500)).optional(),
});

export const networkQueryParamsSchema = z.object({
  cxId: z.string(),
  facilityId: z.string(),
  patientId: z.string(),
  requestId: z.string().optional(),
});

export type NetworkQueryCmd = {
  requestId: string;
  cxId: string;
  facilityId: string;
  patientId: string;
  sources: NetworkSource[];
  override?: boolean;
  commonwell?: boolean;
  carequality?: boolean;
  metadata?: Record<string, string>;
};

export type NetworkQueryStatusCmd = {
  cxId: string;
  patientId: string;
};

/**
 * SDK request parameters for starting a network query.
 */
export type StartNetworkQueryRequest = {
  patientId: string;
  sources: NetworkSource[];
  metadata?: Record<string, string>;
};

/**
 * SDK request parameters for getting network query status.
 */
export type GetNetworkQueryStatusRequest = {
  requestId: string;
};

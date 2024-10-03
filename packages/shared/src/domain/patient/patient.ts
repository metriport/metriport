import { z } from "zod";

export const patientSchema = z.object({
  id: z.string(),
});

export const patientDiscoveryResponseSchema = z.object({
  requestId: z.string(),
});

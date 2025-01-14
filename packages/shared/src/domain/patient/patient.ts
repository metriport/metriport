import { z } from "zod";

export const patientCreateResponseSchema = z.object({
  id: z.string(),
});

export const patientDiscoveryResponseSchema = z.object({
  requestId: z.string(),
});

export const patientDocumentQueryResponseSchema = z.object({
  requestId: z.string(),
});

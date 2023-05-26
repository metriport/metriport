import { z } from "zod";

const typeSchema = z.enum([
  "document",
  "message",
  "transaction",
  "transaction-response",
  "batch",
  "batch-response",
  "history",
  "searchset",
  "collection",
]);

export const bundleEntrySchema = z.object({
  resourceType: z.enum(["Bundle"]),
  id: z.string().optional(),
  meta: z.any().optional(),
  implicitRules: z.string().optional(),
  language: z.string().optional(),
  identifier: z.any().optional(),
  type: typeSchema.optional(),
  timestamp: z.string().optional(),
  total: z.number().optional(),
  link: z.array(z.any()).optional(),
  entry: z.array(z.any()).optional(),
  signature: z.any().optional(),
});

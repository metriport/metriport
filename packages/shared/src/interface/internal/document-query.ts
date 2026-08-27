import { z } from "zod";

export const internalDocumentQueryParamsSchema = z.object({
  cxId: z.string(),
  patientId: z.string(),
  facilityId: z.string().optional(),
  requestId: z.string().optional(),
  forceDownload: z
    .preprocess(v => (v === "true" ? true : v === "false" ? false : v), z.boolean())
    .optional(),
  forcePatientDiscovery: z
    .preprocess(v => (v === "true" ? true : v === "false" ? false : v), z.boolean())
    .optional(),
  cqManagingOrgName: z.string().optional(),
  triggerConsolidated: z
    .preprocess(v => (v === "true" ? true : v === "false" ? false : v), z.boolean())
    .optional(),
});

export type InternalDocumentQueryParams = z.infer<typeof internalDocumentQueryParamsSchema>;

import { z, ZodError, ZodFormattedError } from "zod";
import { dateSchema } from "../../common/date";
import { SearchSetBundle } from "../fhir/bundle";

export const pingWebhookTypeSchema = z.literal(`ping`);
export type PingWebhookType = z.infer<typeof pingWebhookTypeSchema>;

export const consolidatedWebhookTypeSchema = z.literal(`medical.consolidated-data`);
export type ConsolidatedWebhookType = z.infer<typeof consolidatedWebhookTypeSchema>;

export const docDownloadWebhookTypeSchema = z.literal(`medical.document-download`);
export type DocumentDownloadWebhookType = z.infer<typeof docDownloadWebhookTypeSchema>;

export const docConversionWebhookTypeSchema = z.literal(`medical.document-conversion`);
export type DocumentConversionWebhookType = z.infer<typeof docConversionWebhookTypeSchema>;

export const docBulkDownloadWebhookTypeSchema = z.literal(`medical.document-bulk-download-urls`);
export type DocumentBulkDownloadWebhookType = z.infer<typeof docBulkDownloadWebhookTypeSchema>;

export const mapiWebhookTypeSchema = consolidatedWebhookTypeSchema
  .or(consolidatedWebhookTypeSchema)
  .or(docDownloadWebhookTypeSchema)
  .or(docConversionWebhookTypeSchema)
  .or(docBulkDownloadWebhookTypeSchema);
export type MAPIWebhookType = z.infer<typeof mapiWebhookTypeSchema>;

export const webhookTypeSchema = pingWebhookTypeSchema.or(mapiWebhookTypeSchema);
export type WebhookType = z.infer<typeof webhookTypeSchema>;

export const webhookRequestStatus = ["processing", "success", "failure"] as const;
export type WebhookRequestStatus = (typeof webhookRequestStatus)[number];

export const baseWebhookMetadataSchema = z.object({
  messageId: z.string(),
  when: dateSchema,
  /**
   * The metadata sent by the customer when they triggered the operation that resulted in this webhook.
   */
  data: z.unknown().nullish(),
});
export const webhookMetadataSchema = baseWebhookMetadataSchema.merge(
  z.object({
    type: z.string(),
  })
);
export type WebhookMetadata = z.infer<typeof webhookMetadataSchema>;

function createWebhookMetadataSchema<T extends z.ZodType<WebhookType>>(itemSchema: T) {
  return baseWebhookMetadataSchema.merge(
    z.object({
      type: itemSchema,
    })
  );
}

export const pingWebhookRequestDataSchema = z.object({
  meta: createWebhookMetadataSchema(pingWebhookTypeSchema),
  ping: z.string(),
});
export type PingWebhookRequest = z.infer<typeof pingWebhookRequestDataSchema>;

export const filtersSchema = z.record(z.string(), z.string().or(z.boolean().nullish()));

export const consolidatedWebhookPatientSchema = z.object({
  patientId: z.string(),
  externalId: z.string().optional(),
  status: z.enum(["completed", "failed"]),
  bundle: z.custom<SearchSetBundle | undefined>(),
  filters: filtersSchema.nullish(),
});
export type ConsolidatedWebhookPatient = z.infer<typeof consolidatedWebhookPatientSchema>;

export const consolidatedWebhookRequestSchema = z.object({
  meta: createWebhookMetadataSchema(consolidatedWebhookTypeSchema),
  patients: consolidatedWebhookPatientSchema.array(),
});
export type ConsolidatedWebhookRequest = z.infer<typeof consolidatedWebhookRequestSchema>;

export const documentDownloadWebhookPatientSchema = z.object({
  patientId: z.string(),
  status: z.enum(["completed", "failed"]),
  documents: z.array(
    z.object({
      id: z.string(),
      fileName: z.string(),
      description: z.string().optional(),
      status: z.string().optional(),
      indexed: z.string().optional(), // ISO-8601
      mimeType: z.string().optional(),
      size: z.number().optional(), // bytes
      type: z
        .object({
          coding: z
            .array(
              z.object({
                system: z.string().optional().nullable(),
                code: z.string().optional().nullable(),
                display: z.string().optional().nullable(),
              })
            )
            .optional(),
          text: z.string().optional(),
        })
        .optional(),
    })
  ),
});
export type DocumentDownloadWebhookPatient = z.infer<typeof documentDownloadWebhookPatientSchema>;

export const documentDownloadWebhookRequestSchema = z.object({
  meta: createWebhookMetadataSchema(docDownloadWebhookTypeSchema),
  patients: documentDownloadWebhookPatientSchema.array(),
});
export type DocumentDownloadWebhookRequest = z.infer<typeof documentDownloadWebhookRequestSchema>;

export const documentConversionWebhookPatientSchema = z.object({
  patientId: z.string(),
  status: z.enum(["completed", "failed"]),
});
export type DocumentConversionWebhookPatient = z.infer<
  typeof documentConversionWebhookPatientSchema
>;

export const documentConversionWebhookRequestSchema = z.object({
  meta: createWebhookMetadataSchema(docConversionWebhookTypeSchema),
  patients: documentConversionWebhookPatientSchema.array(),
});
export type DocumentConversionWebhookRequest = z.infer<
  typeof documentConversionWebhookRequestSchema
>;

// TODO Implement
export const documentBulkDownloadWebhookRequestSchema = z.object({
  meta: createWebhookMetadataSchema(docBulkDownloadWebhookTypeSchema),
});
export type DocumentBulkDownloadWebhookRequest = z.infer<
  typeof documentBulkDownloadWebhookRequestSchema
>;

export const webhookRequestSchema = z.union([
  pingWebhookRequestDataSchema,
  consolidatedWebhookRequestSchema,
  documentDownloadWebhookRequestSchema,
  documentConversionWebhookRequestSchema,
  documentBulkDownloadWebhookRequestSchema,
]);
export type WebhookRequest = z.infer<typeof webhookRequestSchema>;

export class WebhookRequestParsingFailure {
  constructor(
    readonly errors: ZodError<WebhookRequest>,
    readonly flattened: ZodFormattedError<WebhookRequest>
  ) {}
}

export function isPingWebhookRequest(whRequest: WebhookRequest): whRequest is PingWebhookRequest {
  if (whRequest.meta.type === "ping") return true;
  return false;
}

export function isConsolidatedWebhookRequest(
  whRequest: WebhookRequest
): whRequest is ConsolidatedWebhookRequest {
  if (whRequest.meta.type === "medical.consolidated-data") {
    return true;
  }
  return false;
}

export function isDocumentDownloadWebhookRequest(
  whRequest: WebhookRequest
): whRequest is DocumentDownloadWebhookRequest {
  if (whRequest.meta.type === "medical.document-download") {
    return true;
  }
  return false;
}

export function isDocumentConversionWebhookRequest(
  whRequest: WebhookRequest
): whRequest is DocumentConversionWebhookRequest {
  if (whRequest.meta.type === "medical.document-conversion") {
    return true;
  }
  return false;
}

export function isDocumentBulkDownloadWebhookRequest(
  whRequest: WebhookRequest
): whRequest is DocumentBulkDownloadWebhookRequest {
  if (whRequest.meta.type === "medical.document-bulk-download-urls") {
    return true;
  }
  return false;
}

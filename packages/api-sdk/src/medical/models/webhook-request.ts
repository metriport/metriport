import { dateSchema } from "@metriport/shared";
import { z, ZodError, ZodFormattedError } from "zod";

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

function createWebhookMetadataSchema<T extends z.ZodType<WebhookType>>(itemSchema: T) {
  return z.object({
    messageId: z.string(),
    when: dateSchema,
    type: itemSchema,
    data: z.unknown().nullish(),
  });
}

const pingWebhookRequestDataSchema = z.object({
  meta: createWebhookMetadataSchema(pingWebhookTypeSchema),
  ping: z.string(),
});

const filtersSchema = z.record(z.string(), z.string().nullish());

const consolidatedWebhookRequestSchema = z.object({
  meta: createWebhookMetadataSchema(consolidatedWebhookTypeSchema),
  patients: z
    .object({
      patientId: z.string(),
      status: z.enum(["completed", "failed"]),
      // TODO Do we want to import the FHIR lib so we can return a Bundle<Resource>?
      // bundle: z.unknown().refine(value => value as Bundle<Resource>),
      bundle: z.unknown(),
      filters: filtersSchema,
    })
    .array(),
});
export type ConsolidatedWebhookRequest = z.infer<typeof consolidatedWebhookRequestSchema>;

// TODO Implement
// TODO Implement
// TODO Implement
// TODO Implement
const docDownloadWebhookRequestSchema = z.object({
  meta: createWebhookMetadataSchema(docDownloadWebhookTypeSchema),
});
export type DocumentDownloadWebhookRequest = z.infer<typeof docDownloadWebhookRequestSchema>;

// TODO Implement
// TODO Implement
// TODO Implement
// TODO Implement
const docConversionWebhookRequestSchema = z.object({
  meta: createWebhookMetadataSchema(docConversionWebhookTypeSchema),
});
export type DocumentConversionWebhookRequest = z.infer<typeof docConversionWebhookRequestSchema>;

// TODO Implement
// TODO Implement
// TODO Implement
// TODO Implement
const docBulkDownloadWebhookRequestSchema = z.object({
  meta: createWebhookMetadataSchema(docBulkDownloadWebhookTypeSchema),
});
export type DocumentBulkDownloadWebhookRequest = z.infer<
  typeof docBulkDownloadWebhookRequestSchema
>;

export const webhookRequestSchema = z.union([
  pingWebhookRequestDataSchema,
  consolidatedWebhookRequestSchema,
  docDownloadWebhookRequestSchema,
  docConversionWebhookRequestSchema,
  docBulkDownloadWebhookRequestSchema,
]);
export type WebhookRequest = z.infer<typeof webhookRequestSchema>;

export class WebhookRequestParsingError {
  constructor(
    readonly errors: ZodError<WebhookRequest>,
    readonly flattened: ZodFormattedError<WebhookRequest>
  ) {}
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

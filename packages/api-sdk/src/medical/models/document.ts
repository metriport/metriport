import { DocumentReference as FHIRDocumentReference } from "@medplum/fhirtypes";
import { z } from "zod";

export const documentReferenceSchema = z.object({
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
});
export type DocumentReference = z.infer<typeof documentReferenceSchema>;

export const documentQueryStatusSchema = z.enum(["processing", "completed", "failed"]);
export type DocumentQueryStatus = z.infer<typeof documentQueryStatusSchema>;

export const progressSchema = z.object({
  status: documentQueryStatusSchema,
  total: z.number().optional(),
  successful: z.number().optional(),
  errors: z.number().optional(),
});

export const documentQuerySchema = z.object({
  download: progressSchema.optional(),
  convert: progressSchema.optional(),
  requestId: z.string().optional(),
});

export const bulkGetDocumentUrlQuerySchema = z.object({
  status: documentQueryStatusSchema,
  requestId: z.string().optional(),
});

export type BulkGetDocumentUrlQuery = z.infer<typeof bulkGetDocumentUrlQuerySchema>;
export type DocumentQuery = z.infer<typeof documentQuerySchema>;

export const documentListSchema = z.object({
  documents: z.array(documentReferenceSchema),
});
export type DocumentList = z.infer<typeof documentListSchema>;

export type ListDocumentFilters = {
  dateFrom?: string | Date;
  dateTo?: string | Date;
  content?: string;
};

export type ListDocumentResult = {
  documents: FHIRDocumentReference[];
};

export type UploadDocumentResult = {
  documentReferenceId: string;
  uploadUrl: string;
};

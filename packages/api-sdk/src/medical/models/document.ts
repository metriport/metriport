import { DocumentReference } from "@medplum/fhirtypes";
import { z } from "zod";

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
});

export type DocumentQuery = z.infer<typeof documentQuerySchema>;

export type ListDocumentFilters = {
  dateFrom?: string | Date;
  dateTo?: string | Date;
  organization?: string;
  practitioner?: string;
};

export type ListDocumentResult = {
  documents: DocumentReference[];
};

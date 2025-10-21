import { z } from "zod";
import { Bundle } from "@medplum/fhirtypes";

export interface ExtractionBundle {
  extractedFromDocumentId: string;
  extractedBundle: Bundle;
}

export const extractDocumentRequestSchema = z.object({
  cxId: z.string(),
  patientId: z.string(),
  documentId: z.string(),
});

export type ExtractDocumentRequest = z.infer<typeof extractDocumentRequestSchema>;

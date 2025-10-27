import { z } from "zod";
import { Bundle, DiagnosticReport } from "@medplum/fhirtypes";

export interface ExtractionBundle {
  extractedFromDocumentId: string;
  extractedBundle: Bundle;
}

export const structuredDataExtractionSchema = z.object({
  cxId: z.string(),
  patientId: z.string(),
  documentId: z.string(),
});

export type StructuredDataExtractionRequest = z.infer<typeof structuredDataExtractionSchema>;

export interface ExtractionSource {
  documentId: string;
  resource: DiagnosticReport;
  textContent: string;
}

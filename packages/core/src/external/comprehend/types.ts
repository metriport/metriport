import { z } from "zod";
import type { AnthropicTool } from "../bedrock/agent/anthropic/tool";

export interface ComprehendConfig {
  confidenceThreshold: number;
}

export const extractTextRequestSchema = z.object({
  text: z.string(),
});

export const extractedResourceSchema = z.object({
  resourceType: z.string(),
  id: z.string(),
});

export const extractedMedicationSchema = extractedResourceSchema.extend({
  resourceType: z.literal("Medication"),
  id: z.string(),
});

export const extractedMedicationStatementSchema = extractedResourceSchema.extend({
  resourceType: z.literal("MedicationStatement"),
  medication: z.string(),
});

export const extractTextResponseSchema = z.array(
  z.discriminatedUnion("resourceType", [
    extractedMedicationSchema,
    extractedMedicationStatementSchema,
  ])
);

/**
 * An Anthropic LLM tool that takes unstructured text and returns an array of FHIR resources.
 */
export type ExtractionTool = AnthropicTool<ExtractTextRequest, ExtractTextResponse>;
export type ExtractTextRequest = z.infer<typeof extractTextRequestSchema>;
export type ExtractTextResponse = z.infer<typeof extractTextResponseSchema>;

/**
 * An LLM-friendly schema that is mapped to FHIR resources.
 */
export type ExtractedMedication = z.infer<typeof extractedMedicationSchema>;
export type ExtractedMedicationStatement = z.infer<typeof extractedMedicationStatementSchema>;

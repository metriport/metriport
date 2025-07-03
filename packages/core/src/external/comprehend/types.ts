import type { BedrockChat } from "../langchain/bedrock";
import { Entity } from "@aws-sdk/client-comprehendmedical";
import { Bundle, Medication, MedicationRequest, MedicationStatement } from "@medplum/fhirtypes";

export type BedrockAgent = ReturnType<typeof BedrockChat.prototype.bindTools>;
export type BedrockChatResult = Awaited<ReturnType<typeof BedrockChat.prototype.invoke>>;

export interface ExtractionBudget {
  tokensToLLM: number;
  charactersToComprehend: number;
}

export interface ExtractionUsage {
  llmInputTokens: number;
  llmOutputTokens: number;
  comprehendInputCharacters: number;
}

export interface ExtractionSource {
  getConsolidatedBundle(cxId: string, patientId: string): Promise<Bundle>;
  listDocumentNames(cxId: string, patientId: string): Promise<string[]>;
  getDocument(cxId: string, patientId: string, documentName: string): Promise<Bundle>;
}

export interface ExtractionJob {
  cxId: string;
  patientId: string;
  feature: ExtractionFeature[];
}

export interface DocumentExtractionJob {
  documentPath: string;
  feature: ExtractionFeature[];
}

export type ExtractionFeatureType = "medication" | "condition" | "procedure";

export interface ExtractionFeature {
  type: ExtractionFeatureType;
  confidenceThreshold: number;
}

export interface ExtractionFeaturePrompt {
  toolName: string;
  toolDescription: string;
  toolPrompt: string;
}

export interface EntityGraph extends MedicationEntityGraph {
  entities: Entity[];
}

export interface MedicationEntityGraph {
  medications: Medication[];
  medicationStatements: MedicationStatement[];
  medicationRequests: MedicationRequest[];
}

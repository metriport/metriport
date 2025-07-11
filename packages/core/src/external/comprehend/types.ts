import { Entity } from "@aws-sdk/client-comprehendmedical";
import {
  Bundle,
  Medication,
  MedicationRequest,
  MedicationStatement,
  Condition,
  Procedure,
} from "@medplum/fhirtypes";

export type ComprehendInferenceType = "rxnorm" | "icd10cm" | "snomedct" | "entity";

// EXTRACTION FEATURES
// Each extraction feature corresponds to a tool call provided to the LLM
export type ExtractionFeatureType = "medication" | "condition" | "procedure";

export interface ExtractionFeature {
  type: ExtractionFeatureType;
  confidenceThreshold: number;
}

export interface ComprehendConfig {
  confidenceThreshold: number;
}

export interface ExtractionFeatureConfig {
  toolName: string;
  toolDescription: string;
  toolPrompt: string;
}

// EXTRACTION JOBS
// - may either

export interface ExtractionJob {
  cxId: string;
  patientId: string;
  feature: ExtractionFeature[];
}

export interface DocumentExtractionJob {
  documentPath: string;
  feature: ExtractionFeature[];
}

export interface ExtractionToolCall {
  type: ExtractionFeatureType;
  text: string;
}

export interface ExtractionFeaturePrompt {
  toolName: string;
  toolDescription: string;
  toolPrompt: string;
}

export interface EntityGraph
  extends MedicationEntityGraph,
    ConditionEntityGraph,
    ProcedureEntityGraph {
  entities: Entity[];
}

export interface MedicationEntityGraph {
  medications: Medication[];
  medicationStatements: MedicationStatement[];
  medicationRequests: MedicationRequest[];
}

export interface ConditionEntityGraph {
  conditions: Condition[];
}

export interface ProcedureEntityGraph {
  procedures: Procedure[];
}

export interface ExtractionSource {
  getConsolidatedBundle(cxId: string, patientId: string): Promise<Bundle>;
  listDocumentNames(cxId: string, patientId: string): Promise<string[]>;
  getDocument(cxId: string, patientId: string, documentName: string): Promise<Bundle>;
}

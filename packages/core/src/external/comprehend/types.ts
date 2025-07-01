import { Entity } from "@aws-sdk/client-comprehendmedical";
import { Bundle, Medication, MedicationRequest, MedicationStatement } from "@medplum/fhirtypes";

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

export interface ExtractionFeature {
  type: "medication";
  confidenceThreshold: number;
}

export interface EntityGraph extends MedicationEntityGraph {
  entities: Entity[];
}

export interface MedicationEntityGraph {
  medications: Medication[];
  medicationStatements: MedicationStatement[];
  medicationRequests: MedicationRequest[];
}

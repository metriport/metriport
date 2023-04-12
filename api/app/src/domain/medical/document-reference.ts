import { MedicalDataSource } from "../../external";
import { BaseDomainSoftDelete } from "../base-domain";
import { CodeableConcept } from "./codeable-concept";

export type ExternalDocumentReference = {
  fileName: string;
  location: string;
  description: string | undefined;
  status: string | undefined;
  indexed: string | undefined; // ISO-8601
  mimeType: string | undefined;
  size: number | undefined; // bytes
  type: CodeableConcept | undefined;
};

export const documentQueryStatus = ["processing", "completed"] as const;
export type DocumentQueryStatus = (typeof documentQueryStatus)[number];

export interface DocumentReferenceCreate {
  cxId: string;
  patientId: string;
  source: MedicalDataSource;
  externalId: string;
  data: ExternalDocumentReference;
  raw?: unknown;
}

export interface DocumentReference extends BaseDomainSoftDelete, DocumentReferenceCreate {}

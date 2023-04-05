import { MedicalDataSource } from "../../external";
import { IBaseModel, IBaseModelCreate } from "../../models/_default";
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

export interface DocumentReferenceCreate extends Omit<IBaseModelCreate, "id"> {
  cxId: string;
  patientId: string;
  source: MedicalDataSource;
  externalId: string;
  data: ExternalDocumentReference;
}

export interface DocumentReference extends IBaseModel, DocumentReferenceCreate {}

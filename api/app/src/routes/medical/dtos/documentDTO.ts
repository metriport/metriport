import { DocumentReference } from "../../../domain/medical/document-reference";
import { CodeableConceptDTO, toDTO as codeableToDTO } from "./codeableDTO";

export type DocumentReferenceDTO = {
  id: string;
  fileName: string;
  location: string;
  description: string | undefined;
  status: string | undefined;
  indexed: string | undefined; // ISO-8601
  mimeType: string | undefined;
  size: number | undefined; // bytes
  type: CodeableConceptDTO | undefined;
};

export function toDTO(doc: DocumentReference): DocumentReferenceDTO {
  const { id } = doc;
  const { description, type, status, location, fileName, indexed, mimeType, size } = doc.data;
  return {
    id,
    description: description,
    fileName,
    location,
    type: codeableToDTO(type),
    status: status,
    indexed: indexed,
    mimeType: mimeType,
    size: size,
  };
}

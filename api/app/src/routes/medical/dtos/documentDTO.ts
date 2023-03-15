import { DocumentContent } from "@metriport/commonwell-sdk";
import { DocumentWithLocation } from "../../../external/commonwell/document";

export type DocumentReferenceDTO = {
  id: string | undefined;
  fileName: string;
  location: string;
  description: string | undefined;
  status: string | undefined;
  indexed: string | undefined; // ISO-8601
  mimeType: string | undefined;
  size: number | undefined; // bytes
} & Partial<Pick<DocumentContent, "type">>; // TODO build our own representation

export function dtoFromModel(doc: DocumentWithLocation): DocumentReferenceDTO | undefined {
  const { id, description, type, status, location, fileName, indexed, mimeType, size } = doc;
  return {
    id,
    description,
    fileName,
    location,
    type,
    status,
    indexed,
    mimeType,
    size,
  };
}

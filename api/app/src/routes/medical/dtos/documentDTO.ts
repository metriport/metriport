import { DocumentReference } from "@medplum/fhirtypes";
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

export function toDTO(docs: DocumentReference[] | undefined): DocumentReferenceDTO[] {
  if (docs) {
    return docs.flatMap(doc => {
      if (doc && doc.id && doc.content) {
        const hasAttachment = doc.content[0];

        if (
          hasAttachment &&
          hasAttachment.attachment &&
          hasAttachment.attachment.title &&
          hasAttachment.attachment.url
        ) {
          return {
            id: doc.id,
            description: doc.description,
            fileName: hasAttachment.attachment.title,
            location: hasAttachment.attachment.url,
            type: codeableToDTO(doc.type),
            status: doc.status,
            indexed: hasAttachment.attachment.creation,
            mimeType: hasAttachment.attachment.contentType,
            size: hasAttachment.attachment.size,
          };
        }

        return [];
      }

      return [];
    });
  }

  return [];
}

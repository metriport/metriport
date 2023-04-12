import { DocumentReference, DocumentReferenceContent } from "@medplum/fhirtypes";
import { CodeableConceptDTO, toDTO as codeableToDTO } from "./codeableDTO";

const ATTACHMENT_SOURCE = "S3";

export type DocumentReferenceDTO = {
  id: string;
  fileName: string;
  location: string;
  description: string | undefined;
  status: string | undefined;
  indexed?: string | undefined; // ISO-8601
  mimeType?: string | undefined;
  size?: number | undefined; // bytes
  type: CodeableConceptDTO | undefined;
};

export function toDTO(docs: DocumentReference[] | undefined): DocumentReferenceDTO[] {
  if (docs) {
    return docs.flatMap(doc => {
      if (doc && doc.id && doc.content) {
        const hasS3Attachment = getS3Attachment(doc.content);

        if (
          hasS3Attachment &&
          hasS3Attachment.attachment &&
          hasS3Attachment.attachment.title &&
          hasS3Attachment.attachment.url
        ) {
          return {
            id: doc.id,
            description: doc.description,
            fileName: hasS3Attachment.attachment.title,
            location: hasS3Attachment.attachment.url,
            type: codeableToDTO(doc.type),
            status: doc.status,
          };
        }

        return [];
      }

      return [];
    });
  }

  return [];
}

const getS3Attachment = (content: DocumentReferenceContent[]): DocumentReferenceContent | void => {
  if (content) {
    return content.find(c => {
      if (c.attachment && c.attachment.extension) {
        return c.attachment.extension.find(item => item.valueString === ATTACHMENT_SOURCE);
      }
    });
  }
};

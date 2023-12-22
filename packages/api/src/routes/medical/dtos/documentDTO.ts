import { DocumentReference } from "@medplum/fhirtypes";
import { isMetriportContent } from "@metriport/core/external/fhir/shared/extensions/metriport";
import { capture } from "@metriport/core/util/capture";
import { CodeableConceptDTO, toDTO as codeableToDTO } from "./codeableDTO";

export type DocumentReferenceDTO = {
  id: string;
  fileName: string;
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
        const contents = doc.content.filter(isMetriportContent);
        if (contents.length > 1) {
          capture.message("Doc contains more than one Metriport content item", {
            extra: {
              id: doc.id,
              content_length: contents.length,
            },
          });
        }
        const content = contents[0];
        if (content && content.attachment && content.attachment.title && content.attachment.url) {
          return {
            id: doc.id,
            description: doc.description,
            fileName: content.attachment.title,
            type: codeableToDTO(doc.type),
            status: doc.status,
            indexed: content.attachment.creation,
            mimeType: content.attachment.contentType,
            size: content.attachment.size,
          };
        }
        return [];
      }
      return [];
    });
  }
  return [];
}

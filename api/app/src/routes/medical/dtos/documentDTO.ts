import { DocumentReference } from "@medplum/fhirtypes";
import { toDTO as codeableToDTO } from "./codeableDTO";
import { MetriportApi } from "../../../fern";
import { capture } from "../../../shared/notifications";

export function toDTO(docs: DocumentReference[] | undefined): MetriportApi.Document[] {
  if (docs) {
    return docs.flatMap(doc => {
      if (doc && doc.id && doc.content) {
        const hasAttachment = doc.content[0];

        if (doc.content.length > 1) {
          capture.message("Doc contains more than one content item", {
            extra: {
              id: doc.id,
              content_length: doc.content.length,
            },
          });
        }

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
            indexed:
              hasAttachment.attachment.creation != null
                ? new Date(hasAttachment.attachment.creation)
                : undefined,
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

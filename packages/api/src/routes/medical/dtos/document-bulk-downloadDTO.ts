import { DocumentReference } from "@medplum/fhirtypes";
import { isMetriportContent } from "../../../external/fhir/shared/extensions/metriport";
import { capture } from "../../../shared/notifications";

export type DocumentBulkDownloadDTO = {
  id: string;
  fileName: string;
  description: string | undefined;
  status: string | undefined;
  mimeType: string | undefined;
  size: number | undefined; // bytes
  signedUrl: string;
};

export function toDTO(
  doc: DocumentReference | undefined,
  signedUrl: string
): DocumentBulkDownloadDTO | undefined {
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
    if (
      content &&
      content.attachment &&
      content.attachment.title &&
      content.attachment.contentType &&
      content.attachment.size
    ) {
      return {
        id: doc.id,
        description: doc.description,
        fileName: content.attachment.title,
        status: doc.status,
        mimeType: content.attachment.contentType,
        size: content.attachment.size,
        signedUrl: signedUrl,
      };
    }
  }
  return undefined;
}

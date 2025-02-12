import { DocumentReferenceDTO } from "./documentDTO";
import { DocumentBulkSignerLambdaResponse } from "@metriport/core/external/aws/document-signing/document-bulk-signer-response";
import { toDTO as codeableToDTO } from "./codeableDTO";

export type DocumentBulkUrlDTO = DocumentReferenceDTO & {
  url: string;
};

export function toDTO(docs: DocumentBulkSignerLambdaResponse[] | undefined): DocumentBulkUrlDTO[] {
  if (!docs) return [];
  return docs.map(doc => {
    return {
      id: doc.id,
      description: doc.description,
      fileName: doc.fileName,
      type: codeableToDTO(doc.type),
      status: doc.status,
      indexed: doc.indexed,
      mimeType: doc.mimeType,
      size: doc.size,
      url: doc.url,
    };
  });
}

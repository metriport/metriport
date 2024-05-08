import { XMLParser } from "fast-xml-parser";

type DocumentResponse = {
  mimeType: string;
  DocumentUniqueId: string;
  HomeCommunityId: string;
  RepositoryUniqueId: string;
  NewDocumentUniqueId: string;
  NewRepositoryUniqueId: string;
  Document: string;
};

export function parseMTOMResponse(mtomMessage: string, contentType: string): DocumentResponse[] {
  const contentTypeParams = contentType.split(";").reduce((acc, param) => {
    const [key, value] = param.trim().split("=");
    acc[key] = value.replace(/"/g, ""); // Remove quotes
    return acc;
  }, {} as Record<string, string>);

  const boundary = `--${contentTypeParams.boundary}`;
  const parts = mtomMessage.split(boundary).slice(1, -1); // Remove the first and last empty parts
  const documentResponses: DocumentResponse[] = [];
  const attachments: Record<string, string> = {};

  parts.forEach(part => {
    const headersEndIndex = part.indexOf("\r\n\r\n");
    const headers = part.slice(0, headersEndIndex).trim();
    const content = part.slice(headersEndIndex + 4).trim();

    if (headers.includes(contentTypeParams.type)) {
      const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: "_",
        textNodeName: "_text",
        parseAttributeValue: false,
        removeNSPrefix: true,
      });
      const jsonObj = parser.parse(content);
      const docResponse = jsonObj.Envelope.Body.RetrieveDocumentSetResponse.DocumentResponse;
      if (docResponse) {
        documentResponses.push({
          mimeType: docResponse.mimeType,
          DocumentUniqueId: docResponse.DocumentUniqueId,
          HomeCommunityId: docResponse.HomeCommunityId,
          RepositoryUniqueId: docResponse.RepositoryUniqueId,
          NewDocumentUniqueId: docResponse.NewDocumentUniqueId,
          NewRepositoryUniqueId: docResponse.NewRepositoryUniqueId,
          Document: "", // Placeholder, will be filled later
        });
      }
    } else if (headers.includes("application/octet-stream")) {
      const contentIdMatch = headers.match(/Content-ID: <(.+)>/);
      if (contentIdMatch) {
        const contentId = contentIdMatch[1];
        attachments[contentId] = content;
      }
    }
  });

  // Replace Document placeholders with actual content from attachments
  documentResponses.forEach(docResponse => {
    const href = docResponse.Document;
    const attachmentId = href.slice(4);
    docResponse.Document = attachments[attachmentId] || "Attachment not found";
  });

  return documentResponses;
}

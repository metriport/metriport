import { XMLParser } from "fast-xml-parser";
import { DocumentResponse } from "./dr-response";

type MtomContentType = {
  boundary: string;
  type: string;
  start: string;
  startInfo?: string | undefined;
};

function parseMtomContentType(contentType: string): MtomContentType {
  const contentTypeParams = contentType.split(";").reduce<Record<string, string>>((acc, param) => {
    const index = param.indexOf("=");
    if (index !== -1) {
      const key = param.substring(0, index).trim();
      const value = param
        .substring(index + 1)
        .trim()
        .replace(/"/g, ""); // Remove quotes
      acc[key] = value;
    }
    return acc;
  }, {});

  if (!contentTypeParams.boundary) {
    throw new Error("No boundary parameter found in content type.");
  }
  if (!contentTypeParams.type) {
    throw new Error("No type parameter found in content type.");
  }
  if (!contentTypeParams.start) {
    throw new Error("No start parameter found in content type.");
  }
  return {
    boundary: contentTypeParams.boundary,
    type: contentTypeParams.type,
    start: contentTypeParams.start,
    startInfo: contentTypeParams["start-info"],
  };
}

type MtomHeaders = {
  ContentID: string;
  ContentTransferEncoding?: string | undefined;
  ContentType: string;
};

function parseMtomHeaders(headerPart: string): MtomHeaders {
  const headers = headerPart.split("\\r\\n").reduce<Record<string, string>>((acc, headerLine) => {
    const index = headerLine.indexOf(":");
    if (index !== -1) {
      const key = headerLine.substring(0, index).trim();
      const value = headerLine.substring(index + 1).trim();
      acc[key] = value;
    }
    return acc;
  }, {});

  console.log("headers", headers);

  if (!headers["Content-ID"]) {
    throw new Error("No Content-ID header found in headers.");
  }
  if (!headers["Content-Type"]) {
    throw new Error("No Content-Type header found in headers.");
  }
  return {
    ContentID: headers["Content-ID"],
    ContentTransferEncoding: headers["Content-Transfer-Encoding"],
    ContentType: headers["Content-Type"],
  };
}

export function parseMTOMResponse(mtomMessage: string, contentType: string): DocumentResponse[] {
  const contentTypeParams = parseMtomContentType(contentType);

  const boundary = `--${contentTypeParams.boundary}`;
  const parts = mtomMessage.split(boundary).slice(1, -1); // Remove the first and last empty parts

  const documentResponses: DocumentResponse[] = [];
  const attachments: Record<string, string> = {};

  parts.forEach(part => {
    console.log("part", part);
    const headersEndIndex = part.indexOf("\\r\\n\\r\\n");
    console.log("headersEndIndex", headersEndIndex);
    const headersPart = part.slice(0, headersEndIndex).trim();
    const content = part.slice(headersEndIndex + 4).trim();

    const headers = parseMtomHeaders(headersPart);

    console.log("headers", headers);
    console.log("content", content);

    if (headers.ContentType.includes("application/xop+xml")) {
      const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: "_",
        textNodeName: "_text",
        parseAttributeValue: false,
        removeNSPrefix: true,
      });
      const jsonObj = parser.parse(content);
      console.log("jsonObj", JSON.stringify(jsonObj, null, 2));
      const docResponse = jsonObj.Envelope.Body.RetrieveDocumentSetResponse.DocumentResponse;
      if (docResponse) {
        documentResponses.push({
          mimeType: docResponse.mimeType,
          DocumentUniqueId: docResponse.DocumentUniqueId,
          HomeCommunityId: docResponse.HomeCommunityId,
          RepositoryUniqueId: docResponse.RepositoryUniqueId,
          NewDocumentUniqueId: docResponse.NewDocumentUniqueId,
          NewRepositoryUniqueId: docResponse.NewRepositoryUniqueId,
          Document: docResponse.Document.Include.href,
        });
        console.log("docResponse", documentResponses);
      }
    } else if (headers.ContentType.includes("application/octet-stream")) {
      console.log("here2");
      attachments[headers.ContentID] = content;
    }
  });
  console.log("attachments", attachments);

  // Replace Document placeholders with actual content from attachments
  documentResponses.forEach(docResponse => {
    const href = docResponse.Document;
    const attachmentId = href.slice(4);
    docResponse.Document = attachments[attachmentId] || "Attachment not found";
  });

  return documentResponses;
}

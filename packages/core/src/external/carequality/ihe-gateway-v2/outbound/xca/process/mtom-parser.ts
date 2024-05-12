import { XMLParser } from "fast-xml-parser";
import { DocumentResponse } from "./dr-response";
import { XML_APP_MIME_TYPE, XML_TXT_MIME_TYPE } from "../../../../../../util/mime";

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
      const key = param.substring(0, index).trim().toLowerCase();
      const value = param
        .substring(index + 1)
        .trim()
        .replace(/"/g, "");
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
  const headers = headerPart.split("\n").reduce<Record<string, string>>((acc, headerLine) => {
    const index = headerLine.indexOf(":");
    if (index !== -1) {
      const key = headerLine.substring(0, index).trim().toLowerCase();
      const value = headerLine.substring(index + 1).trim();
      acc[key] = value;
    }
    return acc;
  }, {});

  if (!headers["content-id"]) {
    throw new Error("No Content-ID header found in headers.");
  }
  if (!headers["content-type"]) {
    throw new Error("No Content-Type header found in headers.");
  }
  return {
    ContentID: stripTags(headers["content-id"]),
    ContentTransferEncoding: headers["content-transfer-encoding"],
    ContentType: headers["content-type"],
  };
}

export function parseMTOMResponse(mtomMessage: string, contentType: string): DocumentResponse[] {
  const contentTypeParams = parseMtomContentType(contentType);

  const boundary = `--${contentTypeParams.boundary}`;
  const parts = mtomMessage.split(boundary).slice(1, -1);

  const documentResponses: DocumentResponse[] = [];
  const attachments: Record<string, string> = {};

  parts.forEach(part => {
    let splitter = "\r\n\r\n";
    let headersEndIndex = -1;
    if (contentTypeParams.startInfo) {
      splitter = contentTypeParams.startInfo + splitter;
      headersEndIndex = part.indexOf(splitter);
    }
    if (headersEndIndex === -1) {
      splitter = "\r\n\r\n";
      headersEndIndex = part.indexOf(splitter);
      if (headersEndIndex === -1) {
        splitter = "\n\n";
        headersEndIndex = part.indexOf(splitter);
        if (headersEndIndex === -1) {
          throw new Error("No headers found in part.");
        }
      }
    }

    const headersPart = part.slice(0, headersEndIndex + splitter.length).trim();
    const content = part.slice(headersEndIndex + splitter.length).trim();

    const headers = parseMtomHeaders(headersPart);

    if (headers.ContentType.includes("application/xop+xml")) {
      const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: "_",
        textNodeName: "_text",
        parseAttributeValue: true,
        removeNSPrefix: true,
      });
      const jsonObj = parser.parse(content);

      const docResponses = Array.isArray(
        jsonObj?.Envelope?.Body?.RetrieveDocumentSetResponse?.DocumentResponse
      )
        ? jsonObj.Envelope.Body.RetrieveDocumentSetResponse.DocumentResponse
        : [jsonObj.Envelope.Body.RetrieveDocumentSetResponse.DocumentResponse];
      for (const docResponse of docResponses) {
        // temporarily skip non-xml documents
        if (
          docResponse.mimeType === XML_APP_MIME_TYPE ||
          docResponse.mimeType === XML_TXT_MIME_TYPE
        ) {
          documentResponses.push({
            ...docResponse,
            Document: stripCidPrefix(docResponse.Document.Include._href),
          });
        }
      }
    } else {
      attachments[headers.ContentID] = content;
    }
  });

  // Replace Document placeholders with actual content from attachments
  documentResponses.forEach(docResponse => {
    const document = attachments[docResponse.Document];
    if (!document) {
      throw new Error(`Attachment with ID ${docResponse.Document} not found.`);
    }
    docResponse.Document = document;
  });

  return documentResponses;
}

function stripCidPrefix(cid: string): string {
  return cid.replace("cid:", "");
}

function stripTags(content: string): string {
  return content.replace(/^<|>$/g, "");
}

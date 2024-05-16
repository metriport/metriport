import { XMLParser } from "fast-xml-parser";
import { DocumentResponse } from "../process/dr-response";
import { XML_APP_MIME_TYPE, XML_TXT_MIME_TYPE } from "../../../../../../util/mime";
import { stripCidPrefix, stripTags } from "./cid";

const quoteRegex = /"/g;
const carriageReturnLineFeed = "\r\n\r\n";

type MtomContentType = {
  boundary: string;
  start: string;
  type?: string | undefined;
  startInfo?: string | undefined;
};

export function parseMtomContentType(contentType: string): MtomContentType {
  const contentTypeParams = contentType.split(";").reduce<Record<string, string>>((acc, param) => {
    const index = param.indexOf("=");
    if (index >= 0) {
      const key = param.substring(0, index).trim().toLowerCase();
      const value = param
        .substring(index + 1)
        .trim()
        .replace(quoteRegex, "");
      acc[key] = value;
    }
    return acc;
  }, {});

  if (!contentTypeParams.boundary) {
    throw new Error("No boundary parameter found in content type.");
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

export function parseMtomHeaders(headerPart: string): MtomHeaders {
  const headers = headerPart.split("\n").reduce<Record<string, string>>((acc, headerLine) => {
    const index = headerLine.indexOf(":");
    if (index >= 0) {
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function containsMultipartCidReference(documentResponse: any): boolean {
  return !!documentResponse.Document?.Include?._href;
}

export function parseMTOMResponse(mtomMessage: string, contentType: string): DocumentResponse[] {
  const contentTypeParams = parseMtomContentType(contentType);

  const boundary = `--${contentTypeParams.boundary}`;
  const parts = mtomMessage.split(boundary).slice(1, -1);

  const documentResponsesMultipart: DocumentResponse[] = [];
  const documentResponsesRegular: DocumentResponse[] = [];
  const attachments: Record<string, string> = {};

  parts.forEach(part => {
    let splitter = carriageReturnLineFeed;
    let headersEndIndex = -1;
    if (contentTypeParams.startInfo) {
      splitter = contentTypeParams.startInfo + splitter;
      headersEndIndex = part.indexOf(splitter);
    }
    if (headersEndIndex < 0) {
      splitter = carriageReturnLineFeed;
      headersEndIndex = part.indexOf(splitter);
      if (headersEndIndex < 0) {
        splitter = "\n\n";
        headersEndIndex = part.indexOf(splitter);
        if (headersEndIndex < 0) {
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
      console.log("jsonObj", JSON.stringify(jsonObj, null, 2));

      const docResponses = Array.isArray(
        jsonObj?.Envelope?.Body?.RetrieveDocumentSetResponse?.DocumentResponse
      )
        ? jsonObj.Envelope.Body.RetrieveDocumentSetResponse.DocumentResponse
        : [jsonObj.Envelope.Body.RetrieveDocumentSetResponse.DocumentResponse];
      for (const docResponse of docResponses) {
        if (containsMultipartCidReference(docResponse)) {
          // temporarily skip non-xml documents for multipart mtoms
          if (
            docResponse.mimeType === XML_APP_MIME_TYPE ||
            docResponse.mimeType === XML_TXT_MIME_TYPE
          ) {
            documentResponsesMultipart.push({
              ...docResponse,
              Document: stripCidPrefix(docResponse.Document.Include._href),
            });
          }
        } else {
          documentResponsesRegular.push(docResponse);
        }
      }
    } else {
      attachments[headers.ContentID] = content;
    }
  });

  // Replace Document placeholders with actual content from attachments
  documentResponsesMultipart.forEach(docResponse => {
    const document = attachments[docResponse.Document];
    if (!document) {
      throw new Error(`Attachment for Document ID not found`);
    }
    docResponse.Document = document;
  });

  return [...documentResponsesMultipart, ...documentResponsesRegular];
}

import { XMLParser } from "fast-xml-parser";
import {
  OutboundDocumentRetrievalReq,
  OutboundDocumentRetrievalResp,
  OperationOutcome,
  DocumentReference,
} from "@metriport/ihe-gateway-sdk";

type DRGateway = {
  homeCommunityId: string;
  url: string;
};

type DocumentResponse = {
  "@_size": string;
  "@_title": string;
  "@_creation": string;
  "@_language": string;
  "@_mimeType": string;
  "@_DocumentUniqueId": string;
  "@_HomeCommunityId": string;
  "@_RepositoryUniqueId": string;
};

function parseDocumentReference(documentResponse: DocumentResponse): DocumentReference {
  return {
    size: documentResponse?.["@_size"],
    title: documentResponse?.["@_title"],
    creation: documentResponse?.["@_creation"],
    language: documentResponse?.["@_language"],
    contentType: documentResponse?.["@_mimeType"],
    docUniqueId: documentResponse?.["@_DocumentUniqueId"],
    homeCommunityId: documentResponse?.["@_HomeCommunityId"],
    repositoryUniqueId: documentResponse?.["@_RepositoryUniqueId"],
  };
}

function handleHTTPErrorResponse({
  httpError,
  outboundRequest,
  gateway,
}: {
  httpError: string;
  outboundRequest: OutboundDocumentRetrievalReq;
  gateway: DRGateway;
}): OutboundDocumentRetrievalResp {
  const operationOutcome: OperationOutcome = {
    resourceType: "OperationOutcome",
    id: outboundRequest.id,
    issue: [
      {
        severity: "error",
        code: "http-error",
        details: {
          text: httpError,
        },
      },
    ],
  };
  return {
    id: outboundRequest.id,
    timestamp: outboundRequest.timestamp,
    responseTimestamp: new Date().toISOString(),
    gateway: gateway,
    patientId: outboundRequest.patientId,
    operationOutcome: operationOutcome,
  };
}

function handleSuccessResponse({
  documentResponses,
  outboundRequest,
  gateway,
}: {
  //eslint-disable-next-line @typescript-eslint/no-explicit-any
  documentResponses: any;
  outboundRequest: OutboundDocumentRetrievalReq;
  gateway: DRGateway;
}): OutboundDocumentRetrievalResp {
  //eslint-disable-next-line @typescript-eslint/no-explicit-any
  const documentReferences = documentResponses.map((documentResponse: DocumentResponse) =>
    parseDocumentReference(documentResponse)
  );

  const response: OutboundDocumentRetrievalResp = {
    id: outboundRequest.id,
    timestamp: outboundRequest.timestamp,
    responseTimestamp: new Date().toISOString(),
    gateway,
    documentReference: documentReferences,
  };
  return response;
}

export function processDRResponse({
  xmlStringOrError,
  outboundRequest,
  gateway,
}: {
  xmlStringOrError: string | { error: string };
  outboundRequest: OutboundDocumentRetrievalReq;
  gateway: DRGateway;
}): void | OutboundDocumentRetrievalResp {
  if (typeof xmlStringOrError === "object" && xmlStringOrError.error) {
    return handleHTTPErrorResponse({
      httpError: xmlStringOrError.error,
      outboundRequest,
      gateway,
    });
  } else {
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@_",
      parseAttributeValue: false,
      removeNSPrefix: true,
    });

    if (typeof xmlStringOrError !== "string") {
      throw new Error("xmlStringOrError is not a string");
    }

    const jsonObj = parser.parse(xmlStringOrError);
    console.log(JSON.stringify(jsonObj, null, 2));

    const status = jsonObj?.["Envelope"]?.["Body"]?.["RetrieveDocumentSetResponse"]?.[
      "RegistryResponse"
    ]?.["@_status"]
      ?.split(":")
      .pop();

    if (status === "Success") {
      return handleSuccessResponse({
        documentResponses:
          jsonObj?.["Envelope"]?.["Body"]?.["RetrieveDocumentSetResponse"]?.["RegistryResponse"]?.[
            "DocumentResponse"
          ],
        outboundRequest,
        gateway,
      });
    }
  }
}

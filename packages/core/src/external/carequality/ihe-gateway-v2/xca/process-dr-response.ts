import { XMLParser } from "fast-xml-parser";
import {
  OutboundDocumentRetrievalReq,
  OutboundDocumentRetrievalResp,
  XCAGateway,
  DocumentReference,
} from "@metriport/ihe-gateway-sdk";
import {
  handleRegistryErrorResponse,
  handleHTTPErrorResponse,
  handleEmptyResponse,
  handleSOAPFaultResponse,
} from "./error";

type DocumentResponse = {
  size: string;
  title: string;
  creation: string;
  language: string;
  mimeType: string;
  DocumentUniqueId: string;
  HomeCommunityId: string;
  RepositoryUniqueId: string;
};

function parseDocumentReference(documentResponse: DocumentResponse): DocumentReference {
  return {
    size: documentResponse?.size ? parseInt(documentResponse?.size) : undefined,
    title: documentResponse?.title,
    creation: documentResponse?.creation,
    language: documentResponse?.language,
    contentType: documentResponse?.mimeType,
    docUniqueId: documentResponse?.DocumentUniqueId?.toString(),
    homeCommunityId: documentResponse?.HomeCommunityId,
    repositoryUniqueId: documentResponse?.RepositoryUniqueId,
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
  gateway: XCAGateway;
}): OutboundDocumentRetrievalResp {
  //eslint-disable-next-line @typescript-eslint/no-explicit-any
  const documentReferences = Array.isArray(documentResponses)
    ? documentResponses.map((documentResponse: DocumentResponse) =>
        parseDocumentReference(documentResponse)
      )
    : [parseDocumentReference(documentResponses)];

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
  gateway: XCAGateway;
}): OutboundDocumentRetrievalResp {
  if (typeof xmlStringOrError === "object" && xmlStringOrError.error) {
    return handleHTTPErrorResponse({
      httpError: xmlStringOrError.error,
      outboundRequest,
      gateway,
    });
  } else {
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "_",
      textNodeName: "_text",
      parseAttributeValue: false,
      removeNSPrefix: true,
    });

    if (typeof xmlStringOrError !== "string") {
      throw new Error("xmlStringOrError is not a string");
    }

    const jsonObj = parser.parse(xmlStringOrError);
    const status = jsonObj?.Envelope?.Body?.RetrieveDocumentSetResponse?.RegistryResponse?._status
      ?.split(":")
      .pop();
    const registryErrorList =
      jsonObj?.Envelope?.Body?.RetrieveDocumentSetResponse?.RegistryResponse?.RegistryErrorList;
    const documentResponses =
      jsonObj?.Envelope?.Body?.RetrieveDocumentSetResponse?.DocumentResponse;
    const soapFault = jsonObj?.Envelope?.Body?.Fault;

    if ((status === "Success" || status === "PartialSuccess") && documentResponses) {
      return handleSuccessResponse({
        documentResponses,
        outboundRequest,
        gateway,
      });
    } else if (registryErrorList) {
      return handleRegistryErrorResponse({
        registryErrorList,
        outboundRequest,
        gateway,
      });
    } else if (soapFault) {
      return handleSOAPFaultResponse({
        soapFault,
        outboundRequest,
        gateway,
      });
    } else {
      return handleEmptyResponse({
        outboundRequest,
        gateway,
      });
    }
  }
}

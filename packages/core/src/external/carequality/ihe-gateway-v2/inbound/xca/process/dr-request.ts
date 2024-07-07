import { XMLParser } from "fast-xml-parser";
import { toArray } from "@metriport/shared";
import { iti39RequestSchema, DocumentRequest } from "./schema";
import { InboundDocumentRetrievalReq, DocumentReference } from "@metriport/ihe-gateway-sdk";
import { convertSamlHeaderToAttributes, extractTimestamp } from "../../shared";
import { stripUrnPrefix } from "../../../../../../util/urn";
import { extractText } from "../../../utils";

function extractDocumentReferences(documentRequest: DocumentRequest[]): DocumentReference[] {
  return documentRequest.map(req => ({
    homeCommunityId: stripUrnPrefix(req.HomeCommunityId),
    docUniqueId: stripUrnPrefix(req.DocumentUniqueId),
    repositoryUniqueId: stripUrnPrefix(req.RepositoryUniqueId),
  }));
}

export function processInboundDrRequest(request: string): InboundDocumentRetrievalReq {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "_",
    textNodeName: "_text",
    parseAttributeValue: false,
    removeNSPrefix: true,
  });
  const jsonObj = parser.parse(request);
  try {
    const iti39Request = iti39RequestSchema.parse(jsonObj);
    const samlAttributes = convertSamlHeaderToAttributes(iti39Request.Envelope.Header);
    const documentRequests = toArray(
      iti39Request.Envelope.Body.RetrieveDocumentSetRequest.DocumentRequest
    );
    const documentReference = extractDocumentReferences(documentRequests);

    return {
      id: stripUrnPrefix(extractText(iti39Request.Envelope.Header.MessageID)),
      timestamp: extractTimestamp(iti39Request.Envelope.Header),
      samlAttributes,
      documentReference,
      signatureConfirmation: extractText(
        iti39Request.Envelope.Header.Security.Signature.SignatureValue
      ),
    };
  } catch (error) {
    console.log(error);
    throw new Error(`Failed to parse ITI-39 request: ${error}`);
  }
}

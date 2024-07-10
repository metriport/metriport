import { XMLParser } from "fast-xml-parser";
import { toArray } from "@metriport/shared";
import { iti39RequestSchema, DocumentRequest } from "./schema";
import { InboundDocumentRetrievalReq, DocumentReference } from "@metriport/ihe-gateway-sdk";
import { convertSamlHeaderToAttributes, extractTimestamp } from "../../shared";
import { stripUrnPrefix } from "../../../../../../util/urn";
import { extractText } from "../../../utils";
import { storeDrRequest } from "../../../monitor/store";

function extractDocumentReferences(documentRequest: DocumentRequest[]): DocumentReference[] {
  return documentRequest.map(req => ({
    homeCommunityId: stripUrnPrefix(req.HomeCommunityId),
    docUniqueId: stripUrnPrefix(req.DocumentUniqueId),
    repositoryUniqueId: stripUrnPrefix(req.RepositoryUniqueId),
  }));
}

export async function processInboundDrRequest(
  request: string
): Promise<InboundDocumentRetrievalReq> {
  try {
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "_",
      textNodeName: "_text",
      parseAttributeValue: false,
      removeNSPrefix: true,
    });
    const jsonObj = parser.parse(request);
    const iti39Request = iti39RequestSchema.parse(jsonObj);
    const samlAttributes = convertSamlHeaderToAttributes(iti39Request.Envelope.Header);
    const documentRequests = toArray(
      iti39Request.Envelope.Body.RetrieveDocumentSetRequest.DocumentRequest
    );
    const documentReference = extractDocumentReferences(documentRequests);

    const inboundRequest = {
      id: stripUrnPrefix(extractText(iti39Request.Envelope.Header.MessageID)),
      timestamp: extractTimestamp(iti39Request.Envelope.Header),
      samlAttributes,
      documentReference,
      signatureConfirmation: extractText(
        iti39Request.Envelope.Header.Security.Signature.SignatureValue
      ),
    };

    await storeDrRequest({ request, inboundRequest });
    return inboundRequest;
  } catch (error) {
    throw new Error(`Failed to parse ITI-39 request: ${error}`);
  }
}

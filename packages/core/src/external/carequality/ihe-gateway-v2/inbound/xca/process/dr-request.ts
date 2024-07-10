import { DocumentReference, InboundDocumentRetrievalReq } from "@metriport/ihe-gateway-sdk";
import { errorToString, toArray } from "@metriport/shared";
import { XMLParser } from "fast-xml-parser";
import { out } from "../../../../../../util/log";
import { stripUrnPrefix } from "../../../../../../util/urn";
import { extractText } from "../../../utils";
import { convertSamlHeaderToAttributes, extractTimestamp } from "../../shared";
import { DocumentRequest, iti39RequestSchema } from "./schema";

function extractDocumentReferences(documentRequest: DocumentRequest[]): DocumentReference[] {
  return documentRequest.map(req => ({
    homeCommunityId: stripUrnPrefix(req.HomeCommunityId),
    docUniqueId: stripUrnPrefix(req.DocumentUniqueId),
    repositoryUniqueId: stripUrnPrefix(req.RepositoryUniqueId),
  }));
}

export function processInboundDrRequest(request: string): InboundDocumentRetrievalReq {
  const log = out("Inbound DR Request").log;
  log(JSON.stringify(request));
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
    const msg = "Failed to parse ITI-39 request";
    log(`${msg}: Error - ${errorToString(error)}`);
    throw new Error(`: ${error}`);
  }
}

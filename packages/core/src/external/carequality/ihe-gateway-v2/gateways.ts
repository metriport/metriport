import { XCAGateway, XCPDGateway, SamlAttributes } from "@metriport/ihe-gateway-sdk";
import { validate as validateUuid } from "uuid";
import { wrapIdInUrnUuid } from "../../../util/urn";

import { METRIPORT_HOME_COMMUNITY_ID_NO_PREFIX } from "../shared";
/*
 * Gateways with this url require the Metriport OID instead of the Initiator OID in the SOAP body.
 */
const requiresMetriportOidUrl = [
  "https://carequality.ntstplatform.com:443/Inbound/XCPDRespondingGateway",
  "https://carequality.ntstplatform.com:443/Inbound/XCAGatewayQuery",
  "https://carequality.ntstplatform.com:443/Inbound/XCAGatewayRetrieve",
];

/*
 * Gateways with this url require the URN namespace to NOT be in the SOAP body.
 */
const specialNamespaceRequiredUrl =
  "https://www.medentcq.com:14430/MedentRespondingGateway-1.0-SNAPSHOT/RespondingGateway/xcpd-iti55";

const pointClickCareOid = "2.16.840.1.113883.3.6448";
const redoxOid = "2.16.840.1.113883.3.6147.458";
const redoxGatewayOid = "2.16.840.1.113883.3.6147.458.2";

/*
 * These gateways only accept a single document reference per request.
 */
const gatewaysThatAcceptOneDocRefPerRequest = [pointClickCareOid, redoxOid, redoxGatewayOid];

const surescriptsOid = "2.16.840.1.113883.3.2054.2.1.1";
/*
 * These gateways require a urn:uuid prefix before document Uniwue ids formatted as lowercause uuids
 */

const getDocumentUniqueIdMapping: Record<string, GetDocumentUniqueIdFn> = {
  [surescriptsOid]: wrapDocUniqueIdIfLowercaseUuid,
};

type GetDocumentUniqueIdFn = (docUniqueId: string) => string;
/*
 * Wraps the document unique id in a urn uuid if the gateway requires it and the document unique id is a lowercase UUID.
 */
function wrapDocUniqueIdIfLowercaseUuid(docUniqueId: string): string {
  const isValidUuid = validateUuid(docUniqueId);
  const isLowercase = docUniqueId === docUniqueId.toLowerCase();
  console.log("wrapDocUniqueIdIfLowercaseUuid", docUniqueId, isValidUuid, isLowercase);
  return isValidUuid && isLowercase ? wrapIdInUrnUuid(docUniqueId) : docUniqueId;
}

function defaultGetDocumentUniqueId(docUniqueId: string): string {
  return docUniqueId;
}

export function getDocumentUniqueIdFunctionByGateway(gateway: XCAGateway): GetDocumentUniqueIdFn {
  const fn = getDocumentUniqueIdMapping[gateway.homeCommunityId];
  if (fn) return fn;
  return defaultGetDocumentUniqueId;
}

function requiresMetriportOidInsteadOfInitiatorOid(gateway: XCPDGateway | XCAGateway): boolean {
  return requiresMetriportOidUrl.includes(gateway.url);
}

export function getHomeCommunityId(
  gateway: XCPDGateway | XCAGateway,
  samlAttributes: SamlAttributes
): string {
  return requiresMetriportOidInsteadOfInitiatorOid(gateway)
    ? METRIPORT_HOME_COMMUNITY_ID_NO_PREFIX
    : samlAttributes.homeCommunityId;
}

export function requiresUrnInSoapBody(gateway: XCPDGateway): boolean {
  return gateway.url != specialNamespaceRequiredUrl;
}

export function requiresOnlyOneDocRefPerRequest(gateway: XCAGateway): boolean {
  return gatewaysThatAcceptOneDocRefPerRequest.includes(gateway.homeCommunityId);
}

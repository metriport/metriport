import { XCAGateway, XCPDGateway, SamlAttributes } from "@metriport/ihe-gateway-sdk";
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

/*
 * These gateways require that the home community ID in the DR request is the same as the one
 * in the gateway. But these gateways also return different home community IDs in the DQ response
 * than in the gateway. So we need to handle this and use the request home community ID instead of the response.
 */

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

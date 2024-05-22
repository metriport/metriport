import { XCAGateway, XCPDGateway } from "@metriport/ihe-gateway-sdk";

/*
 * Gateways with this url require the Metriport OID instead of the Initiator OID in the SOAP body.
 */
const requiresMetriportOidUrl =
  "https://carequality.ntstplatform.com:443/Inbound/XCPDRespondingGateway";

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
const enforceSameHomeCommunityIdList = [pointClickCareOid, redoxOid, redoxGatewayOid];

export function requiresMetriportOidInsteadOfInitiatorOid(gateway: XCPDGateway): boolean {
  return gateway.url == requiresMetriportOidUrl;
}

export function requiresUrnInSoapBody(gateway: XCPDGateway): boolean {
  return gateway.url != specialNamespaceRequiredUrl;
}

export function requiresOnlyOneDocRefPerRequest(gateway: XCAGateway): boolean {
  return gatewaysThatAcceptOneDocRefPerRequest.includes(gateway.homeCommunityId);
}

export function requiresRequestHomeCommunityId(gateway: XCAGateway): boolean {
  return enforceSameHomeCommunityIdList.includes(gateway.homeCommunityId);
}

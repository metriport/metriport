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

export const eHexUrlPrefix = "https://hub002prodcq.ehealthexchange.org";

export const pointClickCareOid = "2.16.840.1.113883.3.6448";
export const centralOhioPrimaryCarePhysiciansOid = "1.2.840.114350.1.13.698.2.7.3.688884.100";
export const familyCareNetworkOid = "1.2.840.114350.1.13.699.2.7.3.688884.100";
export const hattiesburgClinicOid = "1.2.840.114350.1.13.281.2.7.3.688884.100";
export const healthPointOid = "1.2.840.114350.1.13.756.2.7.3.688884.100";
export const surescriptsOid = "2.16.840.1.113883.3.2054.2.1.1";

export const epicOidPrefix = "1.2.840.114350.1.13";
export const redoxOidPrefix = "2.16.840.1.113883.3.6147";
export const ntstPrefix = "2.16.840.1.113883.3.3569";

export const kno2OidPrefix = "2.16.840.1.113883.3.3126.2.3";

const gatewayPrefixesThatUseSha1 = [kno2OidPrefix];

export function doesGatewayUseSha1(oid: string): boolean {
  for (const prefix of gatewayPrefixesThatUseSha1) {
    if (oid.startsWith(prefix)) return true;
  }
  return false;
}

/*
 * These gateways only accept a single document reference per request.
 */
const gatewaysThatAcceptOneDocRefPerRequest = [pointClickCareOid, surescriptsOid];

const prefixDocRefsPerRequest: Record<string, number> = {
  [epicOidPrefix]: 9,
  [redoxOidPrefix]: 1,
  [ntstPrefix]: 1,
};

const docRefsPerRequestByGateway: Record<string, number> = {
  [pointClickCareOid]: 1,
  [surescriptsOid]: 1,
  [centralOhioPrimaryCarePhysiciansOid]: 9,
  [familyCareNetworkOid]: 9,
  [healthPointOid]: 9,
  [hattiesburgClinicOid]: 3,
};

export const defaultDocRefsPerRequest = 5;

export function getGatewaySpecificDocRefsPerRequest(gateway: XCAGateway): number {
  if (gateway.homeCommunityId in docRefsPerRequestByGateway) {
    const numDocRefs = docRefsPerRequestByGateway[gateway.homeCommunityId];
    if (numDocRefs) return numDocRefs;
  }

  for (const prefix in prefixDocRefsPerRequest) {
    if (gateway.homeCommunityId.startsWith(prefix)) {
      const numDocRefs = prefixDocRefsPerRequest[prefix];
      if (numDocRefs) return numDocRefs;
    }
  }

  return defaultDocRefsPerRequest;
}

export function doesGatewayNeedDateRanges(url: string): boolean {
  return url.startsWith(eHexUrlPrefix);
}

/*
 * These gateways require a urn:uuid prefix before document Unique ids formatted as lowercase uuids
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

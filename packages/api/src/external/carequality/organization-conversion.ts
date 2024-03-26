import { uuidv7 } from "@metriport/core/util/uuid-v7";
import { XCPDGateways } from "@metriport/ihe-gateway-sdk";
import { CQOrgBasicDetails } from "./command/cq-directory/search-cq-directory";

export function cqOrgsToXCPDGateways(cqOrgs: CQOrgBasicDetails[]): XCPDGateways {
  return cqOrgs.flatMap(org => {
    if (org.urlXCPD) {
      return {
        url: org.urlXCPD,
        oid: org.id,
      };
    }
    return [];
  });
}

export function generateIdsForGateways(gateways: XCPDGateways): XCPDGateways {
  return gateways.map(gateway => ({
    ...gateway,
    id: uuidv7(),
  }));
}

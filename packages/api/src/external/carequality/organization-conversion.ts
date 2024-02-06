import { uuidv7 } from "@metriport/core/util/uuid-v7";
import { XCPDGateways } from "@metriport/ihe-gateway-sdk";
import { CQOrgBasicDetails } from "./command/cq-directory/search-cq-directory";

export function cqOrgsToXCPDGateways(cqOrgs: CQOrgBasicDetails[]): XCPDGateways {
  return cqOrgs.flatMap(org => {
    if (org.urlXCPD) {
      return {
        url: org.urlXCPD,
        oid: org.id,
        id: uuidv7(),
      };
    }
    return [];
  });
}

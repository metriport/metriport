import { uuidv7 } from "@metriport/core/util/uuid-v7";
import { XCPDGateways } from "@metriport/ihe-gateway-sdk";
import { CQOrgBasicDetails } from "../../command/medical/cq-directory/search-cq-directory";

export function cqOrgsToXCPDGateways(cqOrgs: CQOrgBasicDetails[]): XCPDGateways {
  return cqOrgs.map(org => {
    return {
      id: uuidv7(),
      oid: org.id,
      url: org.urlXCPD,
    };
  });
}

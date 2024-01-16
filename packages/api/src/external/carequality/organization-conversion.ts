import { uuidv7 } from "@metriport/core/util/uuid-v7";
import { XCPDGateway } from "@metriport/ihe-gateway-sdk";
import { CQOrgBasicDetails } from "./command/cq-directory/search-cq-directory";

export function cqOrgsToXCPDGateways(cqOrgs: CQOrgBasicDetails[]): XCPDGateway[] {
  return cqOrgs.map(org => {
    return {
      id: uuidv7(),
      oid: org.id,
      url: org.urlXCPD,
    };
  });
}

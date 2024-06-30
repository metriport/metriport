import { uuidv7 } from "@metriport/core/util/uuid-v7";
import { XCPDGateway } from "@metriport/ihe-gateway-sdk";
import { CQOrgBasicDetails } from "./command/cq-directory/search-cq-directory";

export async function cqOrgsToXCPDGateways(cqOrgs: CQOrgBasicDetails[]): Promise<{
  v2Gateways: XCPDGateway[];
}> {
  const v2Gateways: XCPDGateway[] = [];

  for (const org of cqOrgs) {
    if (org.urlXCPD) {
      const gateway = buildXcpdGateway({
        urlXCPD: org.urlXCPD,
        id: org.id,
      });
      v2Gateways.push(gateway);
    }
  }
  return {
    v2Gateways,
  };
}

export function buildXcpdGateway(org: { id: string; urlXCPD: string }): XCPDGateway {
  return {
    url: org.urlXCPD,
    oid: org.id,
    id: uuidv7(),
  };
}

import { uuidv7 } from "@metriport/core/util/uuid-v7";
import { XCPDGateway } from "@metriport/ihe-gateway-sdk";
import { EhexOrgBasicDetails } from "./command/directory/search-ehex-directory";

export async function ehexOrgsToXCPDGateways(
  ehexOrgs: EhexOrgBasicDetails[]
): Promise<XCPDGateway[]> {
  const v2Gateways: XCPDGateway[] = [];

  for (const org of ehexOrgs) {
    if (org.urlXcpd) {
      const gateway = buildXcpdGateway({
        urlXcpd: org.urlXcpd,
        id: org.id,
      });
      v2Gateways.push(gateway);
    }
  }
  return v2Gateways;
}

export function buildXcpdGateway(org: { id: string; urlXcpd: string }): XCPDGateway {
  return {
    url: org.urlXcpd,
    oid: org.id,
    id: uuidv7(),
  };
}

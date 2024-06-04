import { uuidv7 } from "@metriport/core/util/uuid-v7";
import { XCPDGateway } from "@metriport/ihe-gateway-sdk";
import { getOrgOidsWithIHEGatewayV2Enabled, isIHEGatewayV2EnabledForCx } from "../aws/app-config";
import { CQOrgBasicDetails } from "./command/cq-directory/search-cq-directory";

export async function cqOrgsToXCPDGateways(
  cqOrgs: CQOrgBasicDetails[],
  cxId: string
): Promise<{
  v1Gateways: XCPDGateway[];
  v2Gateways: XCPDGateway[];
}> {
  const v1Gateways: XCPDGateway[] = [];
  const v2Gateways: XCPDGateway[] = [];
  const iheGatewayV2OIDs = await getOrgOidsWithIHEGatewayV2Enabled();
  const isV2EnabledForCx = await isIHEGatewayV2EnabledForCx(cxId);

  for (const org of cqOrgs) {
    if (org.urlXCPD) {
      const gateway = buildXcpdGateway({
        urlXCPD: org.urlXCPD,
        id: org.id,
      });
      if (isV2EnabledForCx || iheGatewayV2OIDs.includes(org.id)) {
        v2Gateways.push(gateway);
      } else {
        v1Gateways.push(gateway);
      }
    }
  }
  return {
    v1Gateways,
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

import { uuidv7 } from "@metriport/core/util/uuid-v7";
import { XCPDGateways } from "@metriport/ihe-gateway-sdk";
import { CQOrgBasicDetails } from "./command/cq-directory/search-cq-directory";
import { getOidsWithIHEGatewayV2Enabled } from "../aws/appConfig";

export async function cqOrgsToXCPDGateways(cqOrgs: CQOrgBasicDetails[]): Promise<{
  gatewaysWithIHEGatewayV2Enabled: XCPDGateways;
  gatewaysWithoutIHEGatewayV2Enabled: XCPDGateways;
}> {
  const gatewaysWithIHEGatewayV2Enabled: XCPDGateways = [];
  const gatewaysWithoutIHEGatewayV2Enabled: XCPDGateways = [];
  const iheGatewayV2OIDs = await getOidsWithIHEGatewayV2Enabled();

  for (const org of cqOrgs) {
    if (org.urlXCPD) {
      const gateway = {
        url: org.urlXCPD,
        oid: org.id,
        id: uuidv7(),
      };

      if (iheGatewayV2OIDs.includes(org.id)) {
        gatewaysWithIHEGatewayV2Enabled.push(gateway);
      } else {
        gatewaysWithoutIHEGatewayV2Enabled.push(gateway);
      }
    }
  }

  return {
    gatewaysWithIHEGatewayV2Enabled,
    gatewaysWithoutIHEGatewayV2Enabled,
  };
}

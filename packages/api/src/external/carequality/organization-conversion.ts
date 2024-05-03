import { uuidv7 } from "@metriport/core/util/uuid-v7";
import { XCPDGateway } from "@metriport/ihe-gateway-sdk";
import { CQOrgBasicDetails } from "./command/cq-directory/search-cq-directory";
import { getOidsWithIHEGatewayV2Enabled } from "../aws/appConfig";
import { Config } from "../../shared/config";

export async function cqOrgsToXCPDGateways(cqOrgs: CQOrgBasicDetails[]): Promise<{
  v1Gateways: XCPDGateway[];
  v2Gateways: XCPDGateway[];
}> {
  const v1Gateways: XCPDGateway[] = [];
  const v2Gateways: XCPDGateway[] = [];
  const iheGatewayV2OIDs: string[] = Config.isDev()
    ? Config.getOidsWithIHEGatewayV2Enabled().split(",")
    : await getOidsWithIHEGatewayV2Enabled();

  for (const org of cqOrgs) {
    if (org.urlXCPD) {
      const gateway = {
        url: org.urlXCPD,
        oid: org.id,
        id: uuidv7(),
      };

      if (iheGatewayV2OIDs.includes(org.id)) {
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

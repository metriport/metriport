import { uuidv7 } from "@metriport/core/util/uuid-v7";
import { XCPDGateways } from "@metriport/ihe-gateway-sdk";
import { CQOrgBasicDetails } from "./command/cq-directory/search-cq-directory";
import { getOIDsWithGirthEnabledFeatureFlagValue } from "../aws/appConfig";

export async function cqOrgsToXCPDGateways(
  cqOrgs: CQOrgBasicDetails[]
): Promise<[XCPDGateways, XCPDGateways]> {
  const gatewaysWithGirthEnabledFeatureFlag: XCPDGateways = [];
  const gatewaysWithoutGirthEnabledFeatureFlag: XCPDGateways = [];
  const girthOIDs = await getOIDsWithGirthEnabledFeatureFlagValue();

  for (const org of cqOrgs) {
    if (org.urlXCPD) {
      const gateway = {
        url: org.urlXCPD,
        oid: org.id,
        id: uuidv7(),
      };

      if (girthOIDs.includes(gateway.oid)) {
        gatewaysWithGirthEnabledFeatureFlag.push(gateway);
      } else {
        gatewaysWithoutGirthEnabledFeatureFlag.push(gateway);
      }
    }
  }

  return [gatewaysWithoutGirthEnabledFeatureFlag, gatewaysWithGirthEnabledFeatureFlag];
}

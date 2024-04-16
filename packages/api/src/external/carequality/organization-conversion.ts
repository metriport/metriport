import { uuidv7 } from "@metriport/core/util/uuid-v7";
import { XCPDGateways } from "@metriport/ihe-gateway-sdk";
import { CQOrgBasicDetails } from "./command/cq-directory/search-cq-directory";
import { getOidsWithGirthEnabled } from "../aws/appConfig";

export async function cqOrgsToXCPDGateways(
  cqOrgs: CQOrgBasicDetails[]
): Promise<{ gatewaysWithGirthEnabled: XCPDGateways; gatewaysWithoutGirthEnabled: XCPDGateways }> {
  const gatewaysWithGirthEnabled: XCPDGateways = [];
  const gatewaysWithoutGirthEnabled: XCPDGateways = [];
  const girthOIDs = await getOidsWithGirthEnabled();

  for (const org of cqOrgs) {
    if (org.urlXCPD) {
      const gateway = {
        url: org.urlXCPD,
        oid: org.id,
        id: uuidv7(),
      };

      if (girthOIDs.includes(org.id)) {
        gatewaysWithGirthEnabled.push(gateway);
      } else {
        gatewaysWithoutGirthEnabled.push(gateway);
      }
    }
  }

  return {
    gatewaysWithGirthEnabled,
    gatewaysWithoutGirthEnabled,
  };
}

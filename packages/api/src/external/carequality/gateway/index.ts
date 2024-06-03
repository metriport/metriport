import { Patient } from "@metriport/core/domain/patient";
import { out } from "@metriport/core/util/log";
import { XCPDGateway } from "@metriport/ihe-gateway-sdk";
import { MetriportError } from "@metriport/shared";
import { Config } from "../../../shared/config";
import { getE2eCxIds as getE2eCxIds } from "../../aws/app-config";
import { getCQDirectoryEntryOrFail } from "../command/cq-directory/get-cq-directory-entry";
import { getOrganizationsForXCPD } from "../command/cq-directory/get-organizations-for-xcpd";
import {
  filterCQOrgsToSearch,
  searchCQDirectoriesAroundPatientAddresses,
  toBasicOrgAttributes,
} from "../command/cq-directory/search-cq-directory";
import { buildXcpdGateway, cqOrgsToXCPDGateways } from "../organization-conversion";

type Gateways = {
  v1Gateways: XCPDGateway[];
  v2Gateways: XCPDGateway[];
};

export async function gatherXCPDGateways(patient: Patient): Promise<Gateways> {
  const { log } = out(`gatherXCPDGateways, cx ${patient.cxId}, patient ${patient.id}`);

  /**
   * This is dedicated to E2E testing: limits the XCPD to the System Root's E2E Gateway.
   * Avoid this approach as much as possible.
   */
  const e2eCxId = await getE2eCxIds();
  if (e2eCxId === patient.cxId) {
    log("Limiting to E2E Gateways");
    return getE2eGateways();
  }

  const nearbyOrgsWithUrls = await searchCQDirectoriesAroundPatientAddresses({
    patient,
    mustHaveXcpdLink: true,
  });
  const orgOrderMap = new Map<string, number>();

  nearbyOrgsWithUrls.forEach((org, index) => {
    orgOrderMap.set(org.id, index);
  });

  const allOrgs = await getOrganizationsForXCPD(orgOrderMap);
  const allOrgsWithBasics = allOrgs.map(toBasicOrgAttributes);
  const orgsToSearch = filterCQOrgsToSearch(allOrgsWithBasics);
  const { v1Gateways, v2Gateways } = await cqOrgsToXCPDGateways(orgsToSearch, patient.cxId);

  return {
    v1Gateways,
    v2Gateways,
  };
}

async function getE2eGateways(): Promise<Gateways> {
  const e2eCqDirectoryEntry = await getCQDirectoryEntryOrFail(Config.getSystemRootOID());
  if (!e2eCqDirectoryEntry.urlXCPD) {
    throw new MetriportError("E2E CQ Directory entry missing XCPD URL", undefined, {
      id: e2eCqDirectoryEntry.id,
    });
  }
  const e2eXcpdGateway = buildXcpdGateway({
    urlXCPD: e2eCqDirectoryEntry.urlXCPD,
    id: e2eCqDirectoryEntry.id,
  });
  return {
    v1Gateways: [],
    v2Gateways: [e2eXcpdGateway],
  };
}

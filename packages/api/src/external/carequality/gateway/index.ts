import { Patient } from "@metriport/core/domain/patient";
import { out } from "@metriport/core/util/log";
import { uuidv7 } from "@metriport/core/util/uuid-v7";
import { XCPDGateway } from "@metriport/ihe-gateway-sdk";
import { MetriportError } from "@metriport/shared";
import { Config } from "../../../shared/config";
import { isE2eCx, isEpicEnabledForCx } from "../../aws/app-config";
import { getCQDirectoryEntryOrFail } from "../command/cq-directory/get-cq-directory-entry";
import { getOrganizationsForXCPD } from "../command/cq-directory/get-cq-directory-entry-as-organization";
import {
  CQOrgBasicDetails,
  filterCQOrgsToSearch,
  searchCQDirectoriesAroundPatientAddresses,
  toBasicOrgAttributes,
} from "../command/cq-directory/search-cq-directory";
import { CQDirectoryEntry } from "../cq-directory";

export const EPIC_ORG_NAME = "Epic";

export async function gatherXCPDGateways(patient: Patient): Promise<XCPDGateway[]> {
  const { log } = out(`gatherXCPDGateways, cx ${patient.cxId}, patient ${patient.id}`);

  /**
   * This is dedicated to E2E testing: limits the XCPD to the System Root's E2E Gateway.
   * Avoid this approach as much as possible.
   */
  const isE2e = await isE2eCx(patient.cxId);
  if (isE2e) {
    log("Limiting to E2E Gateways");
    return getE2eGateways();
  }

  const isEpicEnabled = await isEpicEnabledForCx(patient.cxId);

  const nearbyOrgsWithUrls = await searchCQDirectoriesAroundPatientAddresses({
    patient,
    mustHaveXcpdLink: true,
  });
  const orgOrderMap = new Map<string, number>();

  nearbyOrgsWithUrls.forEach((org, index) => {
    orgOrderMap.set(org.id, index);
  });

  const allOrgs = await getOrganizationsForXCPD(orgOrderMap);
  const filteredOrgs = facilitiesWithEpicFilter(allOrgs, isEpicEnabled);
  const allOrgsWithBasics = filteredOrgs.map(toBasicOrgAttributes);
  const orgsToSearch = filterCQOrgsToSearch(allOrgsWithBasics);
  const v2Gateways = await cqOrgsToXCPDGateways(orgsToSearch);

  return v2Gateways;
}

export function facilitiesWithEpicFilter(
  cqDirectoryEntries: CQDirectoryEntry[],
  isEpicEnabled: boolean
): CQDirectoryEntry[] {
  return isEpicEnabled
    ? cqDirectoryEntries
    : cqDirectoryEntries.filter(
        entry => entry.managingOrganization?.trim().toLowerCase() !== EPIC_ORG_NAME.toLowerCase()
      );
}

async function getE2eGateways(): Promise<XCPDGateway[]> {
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
  return [e2eXcpdGateway];
}

async function cqOrgsToXCPDGateways(cqOrgs: CQOrgBasicDetails[]): Promise<XCPDGateway[]> {
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
  return v2Gateways;
}

function buildXcpdGateway(org: { id: string; urlXCPD: string }): XCPDGateway {
  return {
    url: org.urlXCPD,
    oid: org.id,
    id: uuidv7(),
  };
}

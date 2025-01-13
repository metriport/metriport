import { buildDayjs } from "@metriport/shared/common/date";
import { CqDirectorySimplifiedOrg } from "@metriport/shared/interface/external/carequality/directory/simplified-org";
import { Config } from "../../../../shared/config";
import { CQDirectoryEntryData2 } from "../../cq-directory";
import { getCqOrgUrls } from "../../shared";

/**
 * Returns additional, testing orgs to add to the CQ directory on staging/dev envs.
 */
export function getAdditionalOrgs(): CQDirectoryEntryData2[] {
  if (Config.isStaging() || Config.isDev()) {
    const partnerOrgs = getStagingPartnerOrgs();
    const metriportOrg = getMetriportOrg();
    return [...partnerOrgs, metriportOrg];
  }
  return [];
}

function getStagingPartnerOrgs(): CQDirectoryEntryData2[] {
  const additionalOrgsParam = Config.getCqAdditionalOrgs();
  if (!additionalOrgsParam) return [];
  const additionalOrgs = JSON.parse(additionalOrgsParam) as CqDirectorySimplifiedOrg[];
  return additionalOrgs.map(org => ({
    ...org,
    lastUpdatedAtCQ: buildDayjs().toISOString(),
    active: true,
  }));
}

function getMetriportOrg(): CQDirectoryEntryData2 {
  const { urlXCPD, urlDQ, urlDR } = getCqOrgUrls();
  return {
    id: Config.getSystemRootOID(),
    name: Config.getSystemRootOrgName(),
    urlXCPD,
    urlDQ,
    urlDR,
    lastUpdatedAtCQ: buildDayjs().toISOString(),
    active: true,
  };
}

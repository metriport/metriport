import { buildDayjs } from "@metriport/shared/common/date";
import { Config } from "../../../../shared/config";
import { getEhexOrgUrls } from "../../shared";
import { EhexDirectoryEntryData } from "../../ehex-directory";

/**
 * Returns additional, testing orgs to add to the Ehex directory on staging/dev envs.
 */
export function getAdditionalOrgs(): EhexDirectoryEntryData[] {
  if (Config.isStaging() || Config.isDev()) {
    const partnerOrgs = getTestingPartnerOrgs();
    const metriportOrg = getMetriportOrg();
    return [...partnerOrgs, metriportOrg];
  }
  return [];
}

function getTestingPartnerOrgs(): EhexDirectoryEntryData[] {
  const additionalOrgsParam = Config.getEhexAdditionalOrgs();
  if (!additionalOrgsParam) return [];
  const additionalOrgs = JSON.parse(additionalOrgsParam) as EhexDirectoryEntryData[];
  return additionalOrgs.map(org => ({
    ...org,
    lastUpdatedAtEhex: buildDayjs().toISOString(),
    active: true,
  }));
}

function getMetriportOrg(): EhexDirectoryEntryData {
  const { urlXcpd, urlDq, urlDr } = getEhexOrgUrls();
  return {
    id: Config.getSystemRootOID(),
    name: Config.getSystemRootOrgName(),
    urlXcpd,
    urlDq,
    urlDr,
    lastUpdatedAtEhex: buildDayjs().toISOString(),
    active: true,
  };
}

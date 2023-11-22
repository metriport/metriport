import { CQDirectoryEntry, CQDirectoryEntryData } from "../../../domain/medical/cq-directory";
import { validateVersionForUpdate } from "../../../models/_default";
import { BaseUpdateCmd } from "../base-update-command";
import { getCQDirectoryEntryOrFail } from "./get-cq-directory-entry";

export type CQOrganizationUpdateCmd = BaseUpdateCmd & CQDirectoryEntryData;

export const updateCQDirectoryEntry = async (
  cqOrganizationUpdate: CQOrganizationUpdateCmd
): Promise<CQDirectoryEntry> => {
  const { eTag, name, urlXCPD, urlDQ, urlDR, lat, lon, state, data } = cqOrganizationUpdate;

  const org = await getCQDirectoryEntryOrFail({ oid: cqOrganizationUpdate.oid });
  validateVersionForUpdate(org, eTag);

  return org.update({
    name,
    urlXCPD,
    urlDQ,
    urlDR,
    lat,
    lon,
    state,
    data,
  });
};

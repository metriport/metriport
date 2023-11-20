import { CQDirectoryEntryData, CQDirectoryEntry } from "../../../domain/medical/cq-directory";
import { validateVersionForUpdate } from "../../../models/_default";
import { CQDirectoryEntryModel } from "../../../models/medical/cq-directory";
import { executeOnDBTx } from "../../../models/transaction-wrapper";
import { BaseUpdateCmd } from "../base-update-command";
import { getCQOrganizationOrFail } from "./get-organization";

export type CQOrganizationUpdateCmd = BaseUpdateCmd & CQDirectoryEntryData;

export const updateCQDirectoryOrganization = async (
  cqOrganizationUpdate: CQOrganizationUpdateCmd
): Promise<CQDirectoryEntry> => {
  const { eTag, name, urlXCPD, urlDQ, urlDR, lat, lon, state, data } = cqOrganizationUpdate;

  return executeOnDBTx(CQDirectoryEntryModel.prototype, async transaction => {
    const org = await getCQOrganizationOrFail({ oid: cqOrganizationUpdate.oid });

    validateVersionForUpdate(org, eTag);

    return org.update(
      {
        name,
        urlXCPD,
        urlDQ,
        urlDR,
        lat,
        lon,
        state,
        data,
      },
      { transaction }
    );
  });
};

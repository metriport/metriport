import { CQDirectoryOrganizationData, CQOrganization } from "../../../domain/medical/cq-directory";
import { validateVersionForUpdate } from "../../../models/_default";
import { CQOrganizationModel } from "../../../models/medical/cq-directory";
import { executeOnDBTx } from "../../../models/transaction-wrapper";
import { BaseUpdateCmd } from "../base-update-command";
import { getCQOrganizationOrFail } from "./get-organization";

export type CQOrganizationUpdateCmd = BaseUpdateCmd & CQDirectoryOrganizationData;

export const updateCQDirectoryOrganization = async (
  cqOrganizationUpdate: CQOrganizationUpdateCmd
): Promise<CQOrganization> => {
  const { eTag, name, urlXCPD, urlDQ, urlDR, lat, lon, state, data } = cqOrganizationUpdate;

  return executeOnDBTx(CQOrganizationModel.prototype, async transaction => {
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

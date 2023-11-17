import { validateVersionForUpdate } from "../../../models/_default";
import { CQDirectoryModel } from "../../../models/medical/cq-directory";
import { CQDirectoryOrg } from "./create-cq-organization";

export const updateCQDirectoryOrganization = async ({
  existingOrg,
  newData,
}: {
  existingOrg: CQDirectoryModel;
  newData: CQDirectoryOrg;
}): Promise<CQDirectoryModel> => {
  const { eTag, urlXCPD, urlDQ, urlDR } = existingOrg;
  const { name, latitude, longitude, state, data } = newData;

  validateVersionForUpdate(existingOrg, eTag);

  return existingOrg.update({
    name,
    urlXCPD,
    urlDQ,
    urlDR,
    latitude,
    longitude,
    state,
    data,
  });
};

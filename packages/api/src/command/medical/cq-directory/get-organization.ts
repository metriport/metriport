import { CQDirectoryModel } from "../../../models/medical/cq-directory";

export const getCQOrganization = async ({
  oid,
}: Pick<CQDirectoryModel, "oid">): Promise<CQDirectoryModel | null> => {
  const org = await CQDirectoryModel.findOne({
    where: { oid },
  });
  return org;
};

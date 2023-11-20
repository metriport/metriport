import { CQOrganization } from "../../../domain/medical/cq-directory";
import { CQOrganizationModel } from "../../../models/medical/cq-directory";
import NotFoundError from "@metriport/core/util/error/not-found";

export const getCQOrganization = async ({
  oid,
}: Pick<CQOrganization, "oid">): Promise<CQOrganizationModel | undefined> => {
  const org = await CQOrganizationModel.findOne({
    where: { oid },
  });
  return org ?? undefined;
};

export const getCQOrganizationOrFail = async ({
  oid,
}: Pick<CQOrganization, "oid">): Promise<CQOrganizationModel> => {
  const organization = await getCQOrganization({ oid });
  if (!organization) throw new NotFoundError(`Could not find cq organization`, undefined, { oid });
  return organization;
};

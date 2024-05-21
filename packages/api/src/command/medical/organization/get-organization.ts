import { OrgType } from "@metriport/core/domain/organization";
import NotFoundError from "../../../errors/not-found";
import { OrganizationModel } from "../../../models/medical/organization";

type Filter = Pick<OrganizationModel, "cxId"> & Partial<Pick<OrganizationModel, "id">>;

export const getOrganization = async ({
  cxId,
  id,
}: Filter): Promise<OrganizationModel | undefined> => {
  const org = await OrganizationModel.findOne({
    where: { cxId, ...(id ? { id } : undefined) },
  });
  return org ?? undefined;
};

export const getOrganizationOrFail = async (filter: Filter): Promise<OrganizationModel> => {
  const org = await getOrganization(filter);
  if (!org) throw new NotFoundError(`Could not find organization`);
  return org;
};

export async function getCxOrganizationNameOidAndType(
  cxId: string
): Promise<{ name: string; oid: string; type: OrgType }> {
  const cxOrg = await getOrganizationOrFail({ cxId });

  const vendorName = cxOrg.dataValues.data?.name;
  if (!vendorName) throw new Error("Organization name is missing");

  return { name: vendorName, oid: cxOrg.oid, type: cxOrg.data.type };
}

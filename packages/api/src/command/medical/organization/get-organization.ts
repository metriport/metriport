import { NotFoundError } from "@metriport/shared";
import { OrganizationModel } from "../../../models/medical/organization";

type Filter = Pick<OrganizationModel, "cxId"> & Partial<Pick<OrganizationModel, "id">>;

export async function getOrganization({
  cxId,
  id,
}: Filter): Promise<OrganizationModel | undefined> {
  const org = await OrganizationModel.findOne({
    where: { cxId, ...(id ? { id } : undefined) },
  });
  return org ?? undefined;
}

export async function getOrganizationOrFail(filter: Filter): Promise<OrganizationModel> {
  const org = await getOrganization(filter);
  if (!org) throw new NotFoundError(`Could not find organization`);
  return org;
}

export async function getOrganizationByOidOrFail(
  filter: Filter & { oid: string }
): Promise<OrganizationModel> {
  const org = await getOrganizationOrFail(filter);
  if (org.oid !== filter.oid) throw new NotFoundError(`Could not find organization`);
  return org;
}

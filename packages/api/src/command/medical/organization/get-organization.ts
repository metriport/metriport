import { MetriportError, NotFoundError } from "@metriport/shared";
import { OrganizationModel } from "../../../models/medical/organization";
import { Op } from "sequelize";
import { Organization } from "@metriport/core/domain/organization";
import _ from "lodash";

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

export async function getOrganizations({ cxIds }: { cxIds: string[] }): Promise<Organization[]> {
  const orgs = await OrganizationModel.findAll({
    where: { cxId: { [Op.in]: cxIds } },
  });
  return orgs.map(o => o.dataValues);
}

export async function getOrganizationsOrFail({
  cxIds,
}: {
  cxIds: string[];
}): Promise<Organization[]> {
  const orgs = await getOrganizations({ cxIds });
  const foundCxIds = orgs.map(o => o.cxId);
  const missingCxIds = _.difference(cxIds, foundCxIds);
  if (missingCxIds.length > 0) {
    throw new MetriportError(`Could not find all organizations`, undefined, {
      missingCxIds: missingCxIds.join(", "),
    });
  }
  return orgs;
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

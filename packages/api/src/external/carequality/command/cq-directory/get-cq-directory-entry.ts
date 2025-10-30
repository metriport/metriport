import { NotFoundError } from "@metriport/shared";
import { QueryTypes } from "sequelize";
import { z } from "zod";
import { CQDirectoryEntry } from "../../cq-directory";
import { CQDirectoryEntryViewModel } from "../../models/cq-directory-view";

export const cqDirectoryTableAliases = z.enum(["latest", "latest-1", "latest-2", "latest-3"]);
type CqDirectoryTableAliases = z.infer<typeof cqDirectoryTableAliases>;

const tableAliasToName: Record<CqDirectoryTableAliases, string> = {
  latest: "cq_directory_entry_new",
  "latest-1": "cq_directory_entry_backup1",
  "latest-2": "cq_directory_entry_backup2",
  "latest-3": "cq_directory_entry_backup3",
};

export async function getCQDirectoryEntry(
  id: CQDirectoryEntry["id"]
): Promise<CQDirectoryEntry | undefined> {
  const org = await CQDirectoryEntryViewModel.findOne({
    where: { id },
  });
  return org?.dataValues ?? undefined;
}

export async function getCQDirectoryEntryOrFail(
  id: CQDirectoryEntry["id"]
): Promise<CQDirectoryEntry> {
  const organization = await getCQDirectoryEntry(id);
  if (!organization) {
    throw new NotFoundError(`Could not find CQ organization`, undefined, { oid: id });
  }
  return organization;
}

export async function getCqDirectoryEntriesByManagingOrganizationIds(
  managingOrganizationIds: string[],
  tableAlias: CqDirectoryTableAliases
): Promise<string[]> {
  const tableName = tableAliasToName[tableAlias];

  if (managingOrganizationIds.length === 0) {
    return [];
  }

  const whereConditions = managingOrganizationIds
    .map((_, index) => `managing_organization_id ilike :managingOrgId${index}`)
    .join(" OR ");

  const sql = `
  SELECT id
  FROM ${tableName}
  WHERE ${whereConditions}
  `;

  const replacements: Record<string, string> = {};
  managingOrganizationIds.forEach((id, index) => {
    replacements[`managingOrgId${index}`] = `${id}%`;
  });

  const result = await CQDirectoryEntryViewModel.sequelize?.query<{ id: string }>(sql, {
    replacements,
    type: QueryTypes.SELECT,
  });
  return result?.map((entry: { id: string }) => entry.id) ?? [];
}

type BasicOrgDetails = {
  id: string;
  name: string;
  city: string;
  state: string;
};

export async function getCqDirectoryEntriesBasicDetailsByIds(
  ids: string[],
  tableAlias: CqDirectoryTableAliases
): Promise<Array<BasicOrgDetails>> {
  const tableName = tableAliasToName[tableAlias];

  if (ids.length === 0) {
    return [];
  }

  const whereConditions = ids.map((_, index) => `id = :id${index}`).join(" OR ");

  const sql = `
    SELECT id, name, city, state
    FROM ${tableName}
    WHERE ${whereConditions}
  `;

  const replacements: Record<string, string> = {};
  ids.forEach((id, index) => {
    replacements[`id${index}`] = id;
  });

  const result = await CQDirectoryEntryViewModel.sequelize?.query<BasicOrgDetails>(sql, {
    replacements,
    type: QueryTypes.SELECT,
  });

  return result ?? [];
}

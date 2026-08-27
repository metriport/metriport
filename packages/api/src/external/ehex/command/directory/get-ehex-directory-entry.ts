import { NotFoundError } from "@metriport/shared";
import { QueryTypes } from "sequelize";
import { z } from "zod";
import { EhexDirectoryEntry } from "../../ehex-directory";
import { EhexDirectoryEntryViewModel } from "../../models/ehex-directory-view";

export const ehexDirectoryTableAliases = z.enum(["latest", "latest-1", "latest-2", "latest-3"]);
type EhexDirectoryTableAliases = z.infer<typeof ehexDirectoryTableAliases>;
type BasicOrgDetails = {
  id: string;
  name: string;
  city: string;
  state: string;
};

const tableAliasToName: Record<EhexDirectoryTableAliases, string> = {
  latest: "ehex_directory_entry_new",
  "latest-1": "ehex_directory_entry_backup1",
  "latest-2": "ehex_directory_entry_backup2",
  "latest-3": "ehex_directory_entry_backup3",
};

export async function getEhexDirectoryEntry(
  id: EhexDirectoryEntry["id"]
): Promise<EhexDirectoryEntry | undefined> {
  const org = await EhexDirectoryEntryViewModel.findOne({
    where: { id },
  });
  return org?.dataValues ?? undefined;
}

export async function getEhexDirectoryEntryOrFail(
  id: EhexDirectoryEntry["id"]
): Promise<EhexDirectoryEntry> {
  const organization = await getEhexDirectoryEntry(id);
  if (!organization) {
    throw new NotFoundError(`Could not find Ehex organization`, undefined, { oid: id });
  }
  return organization;
}

/**
 * Used by internal routes for analytics on the internal repo.
 */
export async function getEhexDirectoryEntriesByManagingOrganizationIds(
  managingOrganizationIds: string[],
  tableAlias: EhexDirectoryTableAliases
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

  const result = await EhexDirectoryEntryViewModel.sequelize?.query<{ id: string }>(sql, {
    replacements,
    type: QueryTypes.SELECT,
  });
  return result?.map((entry: { id: string }) => entry.id) ?? [];
}

/**
 * Used by internal routes for analytics on the internal repo.
 */
export async function getEhexDirectoryEntriesBasicDetailsByIds(
  ids: string[],
  tableAlias: EhexDirectoryTableAliases
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

  const result = await EhexDirectoryEntryViewModel.sequelize?.query<BasicOrgDetails>(sql, {
    replacements,
    type: QueryTypes.SELECT,
  });

  return result ?? [];
}

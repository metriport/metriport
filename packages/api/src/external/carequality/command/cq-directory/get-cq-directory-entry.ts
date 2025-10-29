import { BadRequestError, MetriportError, NotFoundError } from "@metriport/shared";
import { QueryTypes } from "sequelize";
import { CQDirectoryEntry } from "../../cq-directory";
import { CQDirectoryEntryViewModel } from "../../models/cq-directory-view";

const ALLOWED_TABLE_ALIASES = ["latest", "latest-1", "latest-2", "latest-3"];

const TABLE_ALIAS_TO_NAME: Record<(typeof ALLOWED_TABLE_ALIASES)[number], string> = {
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

function validateTableAlias(
  tableAlias: string
): asserts tableAlias is (typeof ALLOWED_TABLE_ALIASES)[number] {
  if (!ALLOWED_TABLE_ALIASES.includes(tableAlias)) {
    throw new BadRequestError(
      `Invalid table alias. Allowed values are: ${ALLOWED_TABLE_ALIASES.join(", ")}`,
      undefined,
      { tableAlias }
    );
  }
}

function mapTableAliasToName(tableAlias: (typeof ALLOWED_TABLE_ALIASES)[number]): string {
  const tableName = TABLE_ALIAS_TO_NAME[tableAlias];
  if (!tableName) {
    // Should never happen since we're using validated table alias for the lookup.
    throw new MetriportError(`Invalid table alias.`, undefined, {
      tableAlias,
      context: "mapTableAliasToName",
    });
  }
  return tableName;
}

export async function getCqDirectoryEntriesByManagingOrganizationIds(
  managingOrganizationIds: string[],
  tableAlias: string
): Promise<string[]> {
  validateTableAlias(tableAlias);
  const tableName = mapTableAliasToName(tableAlias);

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
  tableAlias: string
): Promise<Array<{ id: string; name: string; city: string; state: string }>> {
  validateTableAlias(tableAlias);
  const tableName = mapTableAliasToName(tableAlias);

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

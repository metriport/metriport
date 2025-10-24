import { BadRequestError, NotFoundError } from "@metriport/shared";
import { QueryTypes } from "sequelize";
import { CQDirectoryEntry } from "../../cq-directory";
import { CQDirectoryEntryViewModel } from "../../models/cq-directory-view";

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

const ALLOWED_TABLE_NAMES = [
  "cq_directory_entry_view",
  "cq_directory_entry_backup1",
  "cq_directory_entry_backup2",
];

function validateTableName(
  tableName: string
): asserts tableName is (typeof ALLOWED_TABLE_NAMES)[number] {
  if (!ALLOWED_TABLE_NAMES.includes(tableName)) {
    throw new BadRequestError(
      `Invalid table name. Allowed values are: ${ALLOWED_TABLE_NAMES.join(", ")}`,
      undefined,
      { tableName }
    );
  }
}

export async function getCqDirectoryEntriesByManagingOrganizationIds(
  managingOrganizationIds: string[],
  tableName: string
): Promise<string[]> {
  validateTableName(tableName);

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
  tableName: string
): Promise<Array<{ id: string; name: string; city: string; state: string }>> {
  validateTableName(tableName);

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

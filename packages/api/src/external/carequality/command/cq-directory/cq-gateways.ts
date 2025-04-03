import { Op, Sequelize } from "sequelize";
import { CQDirectoryEntry } from "../../cq-directory";
import {
  managingOrgIdColumnName,
  rootOrgColumnName,
  urlXcpdColumnName,
} from "../../models/cq-directory-columns";
import { CQDirectoryEntryViewModel } from "../../models/cq-directory-view";

/**
 * Returns the ID of CQ directory entries that are not managed by the organizations provided as
 * parameter.
 *
 * @param managingOrgNames - An array of managing organization names
 * @returns IDs of the CQ directory entries not managed by the provided orgs
 */
export async function getOrganizationIdsNotManagedBy(
  managingOrgNames: string[]
): Promise<string[]> {
  const entries = await CQDirectoryEntryViewModel.findAll({
    attributes: ["id"],
    where: {
      [Op.or]: [
        { rootOrganization: { [Op.is]: undefined } },
        { rootOrganization: { [Op.notIn]: managingOrgNames } },
      ],
    },
  });
  const ids = entries.map(entry => entry.id);
  return ids;
}

export async function getRecordLocatorServiceOrganizations(): Promise<CQDirectoryEntry[]> {
  const rls = await CQDirectoryEntryViewModel.findAll({
    where: {
      urlXCPD: {
        [Op.ne]: "",
      },
      [Op.or]: [
        {
          managingOrganizationId: { [Op.is]: undefined },
        },
        { managingOrganizationId: { [Op.col]: "id" } },
      ],
    },
  });

  const eHex = await CQDirectoryEntryViewModel.findAll({
    where: {
      urlXCPD: {
        [Op.ne]: "",
      },
      rootOrganization: {
        [Op.like]: "eHealth%",
      },
    },
  });

  return [...rls, ...eHex].map(org => org.dataValues);
}

export async function getSublinkOrganizations(): Promise<CQDirectoryEntry[]> {
  const records = await CQDirectoryEntryViewModel.findAll({
    where: {
      urlXCPD: {
        [Op.ne]: "",
      },
      rootOrganization: {
        [Op.notILike]: "commonwell",
      },
      managingOrganizationId: {
        [Op.or]: [
          { [Op.is]: undefined },
          {
            [Op.in]: Sequelize.literal(`(
                SELECT id FROM ${CQDirectoryEntryViewModel.NAME}
                WHERE ${urlXcpdColumnName} IS NULL
                AND (${managingOrgIdColumnName} = id OR ${rootOrgColumnName} = name)
            )`),
          },
        ],
      },
    },
    order: [
      Sequelize.literal(`CASE WHEN LOWER(${rootOrgColumnName}) = 'epic' THEN 0 ELSE 1 END`),
      rootOrgColumnName,
    ],
  });
  return records.map(org => org.dataValues);
}

export async function getStandaloneOrganizations(): Promise<CQDirectoryEntry[]> {
  const records = await CQDirectoryEntryViewModel.findAll({
    where: {
      urlXCPD: {
        [Op.ne]: "",
      },
      id: {
        [Op.and]: [
          {
            [Op.notIn]: Sequelize.literal(`(
                SELECT id FROM ${CQDirectoryEntryViewModel.NAME}
                WHERE ${urlXcpdColumnName} IS NOT NULL
                AND (${managingOrgIdColumnName} IS NULL OR ${managingOrgIdColumnName} = id)
            )`),
          },
          {
            [Op.notIn]: Sequelize.literal(`(
                SELECT id FROM ${CQDirectoryEntryViewModel.NAME}
                WHERE ${urlXcpdColumnName} IS NOT NULL
                AND ${managingOrgIdColumnName} IN (
                    SELECT id FROM ${CQDirectoryEntryViewModel.NAME}
                    WHERE ${urlXcpdColumnName} IS NULL
                    AND (${managingOrgIdColumnName} = id OR ${rootOrgColumnName} = name)
                )
            )`),
          },
        ],
      },
    },
  });
  return records.map(org => org.dataValues);
}

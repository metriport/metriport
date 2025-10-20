import {
  commonwellOid,
  surescriptsOid,
} from "@metriport/core/external/carequality/ihe-gateway-v2/gateways";
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
        { rootOrganization: { [Op.is]: null as unknown as undefined } },
        { rootOrganization: { [Op.notIn]: managingOrgNames } },
      ],
    },
  });
  const ids = entries.map(entry => entry.id);
  return ids;
}

function hasUrlXcpd() {
  return {
    [Op.and]: [
      { urlXCPD: { [Op.not]: null as unknown as undefined } },
      { urlXCPD: { [Op.ne]: "" } },
    ],
  };
}
function hasUrlXcpdRaw() {
  return `(${urlXcpdColumnName} IS NOT NULL AND ${urlXcpdColumnName} != '')`;
}
function doesNotHaveUrlXcpdRaw() {
  return `(${urlXcpdColumnName} IS NULL OR ${urlXcpdColumnName} = '')`;
}

export async function getRecordLocatorServiceOrganizations(): Promise<CQDirectoryEntry[]> {
  const rls = await CQDirectoryEntryViewModel.findAll({
    where: {
      ...hasUrlXcpd(),
      [Op.or]: [
        {
          managingOrganizationId: { [Op.is]: null as unknown as undefined },
        },
        { managingOrganizationId: { [Op.col]: "id" } },
      ],
    },
  });

  const eHex = await CQDirectoryEntryViewModel.findAll({
    where: {
      ...hasUrlXcpd(),
      rootOrganization: {
        [Op.like]: "eHealth%",
      },
    },
  });

  return [...rls, ...eHex].map(org => org.dataValues);
}

// TODO Add a TSDoc explaining what these orgs/entries are, and the diff between RLS and standalone.
export async function getSublinkOrganizations(): Promise<CQDirectoryEntry[]> {
  const records = await CQDirectoryEntryViewModel.findAll({
    where: {
      ...hasUrlXcpd(),
      rootOrganization: {
        [Op.notILike]: "commonwell%",
      },
      managingOrganizationId: {
        [Op.or]: [
          { [Op.is]: null as unknown as undefined },
          {
            [Op.in]: Sequelize.literal(`(
                SELECT id FROM ${CQDirectoryEntryViewModel.NAME}
                WHERE ${doesNotHaveUrlXcpdRaw()}
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
      ...hasUrlXcpd(),
      id: {
        [Op.and]: [
          {
            [Op.notIn]: Sequelize.literal(`(
                SELECT id FROM ${CQDirectoryEntryViewModel.NAME}
                WHERE ${hasUrlXcpdRaw()}
                AND (${managingOrgIdColumnName} IS NULL OR ${managingOrgIdColumnName} = id)
            )`),
          },
          {
            [Op.notIn]: Sequelize.literal(`(
                SELECT id FROM ${CQDirectoryEntryViewModel.NAME}
                WHERE ${hasUrlXcpdRaw()}
                AND ${managingOrgIdColumnName} IN (
                    SELECT id FROM ${CQDirectoryEntryViewModel.NAME}
                    WHERE ${doesNotHaveUrlXcpdRaw()}
                    AND (${managingOrgIdColumnName} = id OR ${rootOrgColumnName} = name)
                )
            )`),
          },
        ],
      },
      // Don't load orgs managed by CW or SS, we want to hit their RLS only once
      managingOrganizationId: {
        [Op.notIn]: [commonwellOid, surescriptsOid],
      },
    },
  });
  return records.map(org => org.dataValues);
}

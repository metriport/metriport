import { Op, Sequelize } from "sequelize";
import { CQDirectoryEntry } from "../../cq-directory";
import { CQDirectoryEntryModel } from "../../models/cq-directory";

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
  const entries = await CQDirectoryEntryModel.findAll({
    attributes: ["id"],
    where: {
      [Op.or]: [
        { managingOrganization: { [Op.is]: undefined } },
        { managingOrganization: { [Op.notIn]: managingOrgNames } },
      ],
    },
  });
  const ids = entries.map(entry => entry.id);
  return ids;
}

async function getRecordLocatorServiceOrganizations(): Promise<CQDirectoryEntry[]> {
  const rls: CQDirectoryEntryModel[] = await CQDirectoryEntryModel.findAll({
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

  const eHex: CQDirectoryEntryModel[] = await CQDirectoryEntryModel.findAll({
    where: {
      urlXCPD: {
        [Op.ne]: "",
      },
      managingOrganization: {
        [Op.like]: "eHealth%",
      },
    },
  });

  return [...rls, ...eHex].map(org => org.dataValues);
}

async function getSublinkOrganizations(): Promise<CQDirectoryEntry[]> {
  return (
    await CQDirectoryEntryModel.findAll({
      where: {
        urlXCPD: {
          [Op.ne]: "",
        },
        managingOrganization: {
          [Op.notILike]: "commonwell",
        },
        managingOrganizationId: {
          [Op.or]: [
            { [Op.is]: undefined },
            {
              [Op.in]: Sequelize.literal(`(
                SELECT id FROM cq_directory_entry
                WHERE url_xcpd IS NULL
                AND (managing_organization_id = id OR managing_organization = name)
            )`),
            },
          ],
        },
      },
      order: [
        Sequelize.literal("CASE WHEN LOWER(managing_organization) = 'epic' THEN 0 ELSE 1 END"),
        "managing_organization",
      ],
    })
  ).map(org => org.dataValues);
}

async function getStandaloneOrganizations(): Promise<CQDirectoryEntry[]> {
  return (
    await CQDirectoryEntryModel.findAll({
      where: {
        urlXCPD: {
          [Op.ne]: "",
        },
        id: {
          [Op.and]: [
            {
              [Op.notIn]: Sequelize.literal(`(
                SELECT id FROM cq_directory_entry
                WHERE url_xcpd IS NOT NULL
                AND (managing_organization_id IS NULL OR managing_organization_id = id)
            )`),
            },
            {
              [Op.notIn]: Sequelize.literal(`(
                SELECT id FROM cq_directory_entry
                WHERE url_xcpd IS NOT NULL
                AND managing_organization_id IN (
                    SELECT id FROM cq_directory_entry
                    WHERE url_xcpd IS NULL
                    AND (managing_organization_id = id OR managing_organization = name)
                )
            )`),
            },
          ],
        },
      },
    })
  ).map(org => org.dataValues);
}

function sortOrgsByNearbyOrder(orgs: CQDirectoryEntry[], orderMap: Map<string, number>) {
  return orgs.sort((a, b) => {
    const orderA = orderMap.get(a.id) ?? Number.MAX_SAFE_INTEGER;
    const orderB = orderMap.get(b.id) ?? Number.MAX_SAFE_INTEGER;

    return orderA - orderB;
  });
}

export async function getOrganizationsForXCPD(
  nearbyOrgOrderMap: Map<string, number>
): Promise<CQDirectoryEntry[]> {
  const [rlsAndEhex, sublinks, standalone] = await Promise.all([
    getRecordLocatorServiceOrganizations(),
    getSublinkOrganizations(),
    getStandaloneOrganizations(),
  ]);

  const sortedSublinks = sortOrgsByNearbyOrder(sublinks, nearbyOrgOrderMap);
  const sortedStandalone = sortOrgsByNearbyOrder(standalone, nearbyOrgOrderMap);

  return [...rlsAndEhex, ...sortedSublinks, ...sortedStandalone];
}

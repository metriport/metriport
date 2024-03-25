import { Op, Sequelize } from "sequelize";
import { CQDirectoryEntryModel } from "../../models/cq-directory";

export async function setEntriesAsGateway(oids: string[]): Promise<void> {
  console.log(`Found ${oids.length} gateways in the CQ directory. Updating...`);
  await CQDirectoryEntryModel.update(
    {
      gateway: true,
    },
    {
      where: { id: { [Op.in]: oids } },
    }
  );
}

// move this to a function that queries entries not from CW, only need the OID
// check the json ramil sent to find if we can use the managing_org (name) to filter non-CW entries, or whether its a multi-level recursive structure
export async function getOrganizationsWithXCPD(): Promise<CQDirectoryEntryModel[]> {
  return CQDirectoryEntryModel.findAll({
    where: {
      urlXCPD: {
        [Op.ne]: "",
      },
    },
  });
}

export async function getRecordLocatorServiceOrganizations(): Promise<CQDirectoryEntryModel[]> {
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

  return [...rls, ...eHex];
}

export async function getSublinkOrganizations(): Promise<CQDirectoryEntryModel[]> {
  return CQDirectoryEntryModel.findAll({
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
  });
}

export async function getStandaloneOrganizations(): Promise<CQDirectoryEntryModel[]> {
  return CQDirectoryEntryModel.findAll({
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
  });
}

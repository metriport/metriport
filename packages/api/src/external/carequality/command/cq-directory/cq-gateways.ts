import { Op } from "sequelize";
import { CQDirectoryEntryModel } from "../../models/cq-directory";

export async function updateCQGateways(gateways: string[]): Promise<void> {
  console.log(`Found ${gateways.length} gateways in the CQ directory. Updating...`);
  await Promise.allSettled(gateways.map(gateway => updateCQGateway(gateway)));
}

export async function updateCQGateway(gateway: string): Promise<void> {
  await CQDirectoryEntryModel.update(
    {
      gateway: true,
    },
    {
      where: {
        name: {
          [Op.like]: `%${gateway}%`,
        },
        urlXCPD: {
          [Op.ne]: "",
        },
      },
    }
  );
}

export async function getCQGateways(): Promise<CQDirectoryEntryModel[]> {
  return CQDirectoryEntryModel.findAll({
    where: {
      gateway: true,
      urlXCPD: {
        [Op.ne]: "",
      },
    },
  });
}

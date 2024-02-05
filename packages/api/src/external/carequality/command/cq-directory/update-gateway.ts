import { Op } from "sequelize";
import { CQDirectoryEntryModel } from "../../models/cq-directory";

export async function updateGateway(gateway: string): Promise<void> {
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

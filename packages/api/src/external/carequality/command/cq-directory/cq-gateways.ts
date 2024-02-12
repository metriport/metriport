import { Op } from "sequelize";
import { CQDirectoryEntryModel } from "../../models/cq-directory";
import { capture } from "@metriport/core/util/notifications";

export async function updateCQGateways(gateways: string[]): Promise<void> {
  console.log(`Found ${gateways.length} gateways in the CQ directory. Updating...`);
  await Promise.allSettled(
    gateways.map(gateway =>
      updateCQGateway(gateway).catch(error => {
        const msg = `Failed to update gateway ${gateway} in the CQ directory. Skipping...`;
        console.log(`${msg}. Cause: ${error}`);
        capture.error(msg, { extra: { context: `cq.directory.updateCQGateways`, error } });
        throw error;
      })
    )
  );
}

export async function updateCQGateway(gateway: string): Promise<void> {
  await CQDirectoryEntryModel.update(
    {
      gateway: true,
    },
    {
      where: {
        name: {
          [Op.like]: `${gateway}%`,
        },
        urlXCPD: {
          [Op.ne]: null,
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

import { Op } from "sequelize";
import { CQDirectoryEntryModel } from "../../models/cq-directory";
import { capture } from "@metriport/core/util/notifications";

export async function updateCQGateways(gatewayOids: string[]): Promise<void> {
  console.log(`Found ${gatewayOids.length} gateways in the CQ directory. Updating...`);
  await Promise.allSettled(
    gatewayOids.map(gatewayOid =>
      updateCQGateway(gatewayOid).catch(error => {
        const msg = `Failed to update gateway ${gatewayOid} in the CQ directory. Skipping...`;
        console.log(`${msg}. Cause: ${error}`);
        capture.error(msg, { extra: { context: `cq.directory.updateCQGateways`, error } });
        throw error;
      })
    )
  );
}

export async function updateCQGateway(gatewayOid: string): Promise<void> {
  await CQDirectoryEntryModel.update(
    {
      gateway: true,
    },
    {
      where: {
        id: gatewayOid,
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
    },
  });
}

export async function getOrganizationsWithXCPD(): Promise<CQDirectoryEntryModel[]> {
  return CQDirectoryEntryModel.findAll({
    where: {
      urlXCPD: {
        [Op.ne]: "",
      },
    },
  });
}

export async function getGatewaysAndNonGateways(): Promise<{
  gateways: CQDirectoryEntryModel[];
  nonGateways: CQDirectoryEntryModel[];
}> {
  const cqOrgs = await getOrganizationsWithXCPD();
  return { gateways: cqOrgs.filter(o => o.gateway), nonGateways: cqOrgs.filter(o => !o.gateway) };
}

import { Op, fn, where, col } from "sequelize";
import { CQLink } from "../cq-patient-data";
import { CQDirectoryEntryModel } from "../../../external/carequality/models/cq-directory";

export async function filterCqLinksByManagingOrg(
  name: string,
  cqLinks: CQLink[]
): Promise<CQLink[]> {
  console.log("TESTING ZERO", name);
  const managingOrg = await CQDirectoryEntryModel.findOne({
    where: where(fn("LOWER", col("name")), fn("LOWER", name)),
  });

  console.log("TESTING ONE", managingOrg);

  if (!managingOrg) {
    return [];
  }

  const managingOrgChildren = await CQDirectoryEntryModel.findAll({
    where: {
      managingOrganizationId: {
        [Op.like]: "%" + managingOrg.id + "%",
      },
    },
  });

  console.log("TESTING TWO", managingOrgChildren);

  const cqOrgIds = managingOrgChildren.map(org => org.id);

  console.log("TESTING THREE", cqOrgIds);

  const links = cqLinks.filter(link => cqOrgIds.includes(link.oid));

  console.log("TESTING FOUR", links);

  return links;
}

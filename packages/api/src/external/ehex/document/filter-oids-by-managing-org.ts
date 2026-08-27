import { Op, col, fn, where } from "sequelize";
import { EhexDirectoryEntryViewModel } from "../../ehex/models/ehex-directory-view";
import { EhexLink } from "../ehex-patient-data";

export async function filterEhexLinksByManagingOrg(
  name: string,
  ehexLinks: EhexLink[]
): Promise<EhexLink[]> {
  const managingOrg = await EhexDirectoryEntryViewModel.findOne({
    where: where(fn("LOWER", col("name")), fn("LOWER", name)),
  });

  if (!managingOrg) {
    return [];
  }

  const managingOrgChildren = await EhexDirectoryEntryViewModel.findAll({
    where: {
      managingOrganizationId: {
        [Op.like]: managingOrg.id + "%",
      },
    },
  });

  const ehexOrgIds = managingOrgChildren.map(org => org.id);

  return ehexLinks.filter(link => ehexOrgIds.includes(link.oid));
}

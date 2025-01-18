import { CQDirectoryEntry2 } from "../../cq-directory";
import { CQDirectoryEntryViewModel } from "../../models/cq-directory-view";

export async function getCQDirectoryEntriesByFilter(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  { filter }: { filter: string }
): Promise<CQDirectoryEntry2[]> {
  const org = await CQDirectoryEntryViewModel.findAll();
  return org.map(org => org.dataValues);
}

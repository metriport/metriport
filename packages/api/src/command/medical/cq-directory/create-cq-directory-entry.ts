import { uuidv7 } from "@metriport/core/util/uuid-v7";
import { CQDirectoryEntry, CQDirectoryEntryData } from "../../../domain/medical/cq-directory";
import { CQDirectoryEntryModel } from "../../../models/medical/cq-directory";
import { getCQDirectoryEntry } from "./get-cq-directory-entry";
import { updateCQDirectoryEntry } from "./update-cq-directory-entry";

export type CQOrganizationCreateResponse = { org: CQDirectoryEntry } & {
  updated: boolean;
};

export const createOrUpdateCQDirectoryEntry = async (
  orgData: CQDirectoryEntryData
): Promise<CQOrganizationCreateResponse> => {
  // ensure we never create more than one entry per cq org
  const existingOrg = await getCQDirectoryEntry({ oid: orgData.oid });
  if (existingOrg) {
    const updOrg = await updateCQDirectoryEntry({ ...orgData, id: existingOrg.id });
    return { org: updOrg, updated: true };
  }

  const org = await createDirectoryDirectoryEntry(orgData);
  return { org, updated: false };
};

async function createDirectoryDirectoryEntry(
  orgData: CQDirectoryEntryData
): Promise<CQDirectoryEntry> {
  return await CQDirectoryEntryModel.create({
    id: uuidv7(),
    ...orgData,
  });
}

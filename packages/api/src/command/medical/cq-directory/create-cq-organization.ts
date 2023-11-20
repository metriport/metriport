import { uuidv7 } from "@metriport/core/util/uuid-v7";
import { CQDirectoryEntryData, CQDirectoryEntry } from "../../../domain/medical/cq-directory";
import { CQDirectoryEntryModel } from "../../../models/medical/cq-directory";
import { getCQOrganization } from "./get-organization";
import { updateCQDirectoryOrganization } from "./update-organization";

export type CQOrganizationCreateResponse = { org: CQDirectoryEntry } & {
  updated: boolean;
};

export const createOrUpdateCQOrganization = async (
  orgData: CQDirectoryEntryData
): Promise<CQOrganizationCreateResponse> => {
  // ensure we never create more than one entry per cq org
  const existingOrg = await getCQOrganization({ oid: orgData.oid });
  if (existingOrg) {
    const updOrg = await updateCQDirectoryOrganization({ ...orgData, id: existingOrg.id });
    return { org: updOrg, updated: true };
  }

  const org = await createDirectoryOrganization(orgData);
  return { org, updated: false };
};

async function createDirectoryOrganization(
  orgData: CQDirectoryEntryData
): Promise<CQDirectoryEntry> {
  const org = await CQDirectoryEntryModel.create({
    id: uuidv7(),
    ...orgData,
  });

  return org;
}

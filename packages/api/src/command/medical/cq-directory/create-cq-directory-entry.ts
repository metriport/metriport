import { uuidv7 } from "@metriport/core/util/uuid-v7";
import { CQDirectoryEntry, CQDirectoryEntryData } from "../../../domain/medical/cq-directory";
import { CQDirectoryEntryModel } from "../../../models/medical/cq-directory";
import { getCQDirectoryEntry, getCQDirectoryEntriesByOids } from "./get-cq-directory-entry";
import { updateCQDirectoryEntry } from "./update-cq-directory-entry";

export type CQOrganizationCreateResponse = { org: CQDirectoryEntry } & {
  updated: boolean;
};

export type CQDirectoryEntryDataWithId = CQDirectoryEntryData & { id: string };

export const createOrUpdateCQDirectoryEntry = async (
  orgData: CQDirectoryEntryData
): Promise<CQOrganizationCreateResponse> => {
  // ensure we never create more than one entry per cq org
  const existingOrg = await getCQDirectoryEntry({ oid: orgData.oid });
  if (existingOrg) {
    const updOrg = await updateCQDirectoryEntry({ ...orgData, id: existingOrg.id });
    return { org: updOrg, updated: true };
  }

  const org = await createCQDirectoryEntry(orgData);
  return { org, updated: false };
};

async function createCQDirectoryEntry(orgData: CQDirectoryEntryData): Promise<CQDirectoryEntry> {
  return await CQDirectoryEntryModel.create({
    id: uuidv7(),
    ...orgData,
  });
}

export const createOrUpdateCQDirectoryEntries = async (
  orgDataArray: CQDirectoryEntryData[]
): Promise<CQOrganizationCreateResponse[]> => {
  const oids = orgDataArray.map(data => data.oid);
  const existingEntries = await getCQDirectoryEntriesByOids(oids);

  const newEntries: CQDirectoryEntryData[] = [];
  const updateEntries: CQDirectoryEntryDataWithId[] = [];
  orgDataArray.forEach(orgData => {
    const existingEntry = existingEntries.find(entry => entry.oid === orgData.oid);
    if (existingEntry) {
      updateEntries.push({ ...orgData, id: existingEntry.id });
    } else {
      newEntries.push(orgData);
    }
  });

  const createdEntries = newEntries.length > 0 ? await createCQDirectoryEntries(newEntries) : [];

  const updatedEntries =
    updateEntries.length > 0 ? await updateCQDirectoryEntries(updateEntries) : [];

  return [
    ...createdEntries.map(org => ({ org, updated: false })),
    ...updatedEntries.map(org => ({ org, updated: true })),
  ];
};

const createCQDirectoryEntries = async (
  orgDataArray: CQDirectoryEntryData[]
): Promise<CQDirectoryEntry[]> => {
  const entriesWithIds = orgDataArray.map(orgData => ({
    id: uuidv7(),
    ...orgData,
  }));

  return await CQDirectoryEntryModel.bulkCreate(entriesWithIds);
};

const updateCQDirectoryEntries = async (
  updateEntries: CQDirectoryEntryDataWithId[]
): Promise<CQDirectoryEntry[]> => {
  const updatedEntries = [];

  for (const entry of updateEntries) {
    const updated = await CQDirectoryEntryModel.update(entry, {
      where: { id: entry.id },
      returning: true,
    });

    // The updated object is typically the second element in the returned array from Sequelize update method
    if (updated && updated[1] && updated[1][0]) {
      updatedEntries.push(updated[1][0]);
    }
  }

  return updatedEntries;
};

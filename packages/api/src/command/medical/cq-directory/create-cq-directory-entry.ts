import { uuidv7 } from "@metriport/core/util/uuid-v7";
import { CQDirectoryEntry, CQDirectoryEntryData } from "../../../domain/medical/cq-directory";
import { CQDirectoryEntryModel } from "../../../models/medical/cq-directory";
import { getCQDirectoryEntry, getCQDirectoryEntriesByOids } from "./get-cq-directory-entry";
import { updateCQDirectoryEntry } from "./update-cq-directory-entry";

export type CQOrganizationCreateResponse = { org: CQDirectoryEntry } & {
  updated: boolean;
};

export type CQOrganizatioBulkCreateResponse = { updated: number; added: number };

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

const createCQDirectoryEntry = async (orgData: CQDirectoryEntryData): Promise<CQDirectoryEntry> => {
  return await CQDirectoryEntryModel.create({
    id: uuidv7(),
    ...orgData,
  });
};

export const createOrUpdateCQDirectoryEntries = async (
  orgDataArray: CQDirectoryEntryData[]
): Promise<CQOrganizatioBulkCreateResponse> => {
  const oids = orgDataArray.map(data => data.oid);
  const existingEntries = await getCQDirectoryEntriesByOids(oids); // could break this up further and parallilze

  const newEntries: CQDirectoryEntryData[] = [];
  const updateEntries: CQDirectoryEntryDataWithId[] = [];
  orgDataArray.forEach(orgData => {
    const existingEntry = existingEntries.find(entry => entry === orgData.oid);
    if (existingEntry) {
      const orgDataWithId = orgData as CQDirectoryEntryDataWithId;
      orgDataWithId.id = existingEntry;
      updateEntries.push(orgDataWithId);
    } else {
      newEntries.push(orgData);
    }
  });

  const numNewEntries = newEntries.length;
  const numUpdEntries = updateEntries.length;

  if (numNewEntries) await createCQDirectoryEntries(newEntries);
  if (numUpdEntries) await updateCQDirectoryEntries(updateEntries);

  return { added: numNewEntries, updated: numUpdEntries };
};

const createCQDirectoryEntries = async (orgDataArray: CQDirectoryEntryData[]): Promise<void> => {
  const entriesWithIds = orgDataArray.map(orgData => ({
    id: uuidv7(),
    ...orgData,
  }));

  await CQDirectoryEntryModel.bulkCreate(entriesWithIds);
};

const updateCQDirectoryEntries = async (
  updateEntries: CQDirectoryEntryDataWithId[]
): Promise<void> => {
  for (const entry of updateEntries) {
    await CQDirectoryEntryModel.update(entry, {
      where: { id: entry.id },
      returning: true,
    });
  }
};

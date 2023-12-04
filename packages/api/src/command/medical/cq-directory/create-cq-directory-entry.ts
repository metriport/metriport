import { uuidv7 } from "@metriport/core/util/uuid-v7";
import { CQDirectoryEntry, CQDirectoryEntryData } from "../../../domain/medical/cq-directory";
import { CQDirectoryEntryModel } from "../../../models/medical/cq-directory";
import { getCQDirectoryEntry, getCQDirectoryEntriesByOids } from "./get-cq-directory-entry";
import { updateCQDirectoryEntry } from "./update-cq-directory-entry";
import { QueryTypes, Sequelize } from "sequelize";
import { Config } from "../../../shared/config";
import { z } from "zod";

const QueryResultSchema = z.array(
  z.object({
    point: z.string(),
  })
);

const sqlDBCreds = Config.getDBCreds();
const dbCreds = JSON.parse(sqlDBCreds);

const sequelize = new Sequelize(dbCreds.dbname, dbCreds.username, dbCreds.password, {
  host: dbCreds.host,
  port: dbCreds.port,
  dialect: dbCreds.engine,
});

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
  const existingEntries = await getCQDirectoryEntriesByOids(oids); // could break this up further and parallelize

  const newEntries: CQDirectoryEntryData[] = [];
  const updateEntries: CQDirectoryEntryDataWithId[] = [];
  orgDataArray.forEach(orgData => {
    const existingEntry = existingEntries.find(entry => entry.oid === orgData.oid);
    if (existingEntry) {
      const latestVersion = existingEntry.lastUpdated === orgData.lastUpdated;
      if (!latestVersion) {
        const orgDataWithId = orgData as CQDirectoryEntryDataWithId;
        orgDataWithId.id = existingEntry.id;
        updateEntries.push(orgDataWithId);
      }
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

async function computeEarthPoint(orgData: CQDirectoryEntryData): Promise<string | undefined> {
  if (orgData.lat && orgData.lon) {
    const query = "SELECT ll_to_earth(:lat, :lon) as point";
    const pointQueryResult = await sequelize.query(query, {
      replacements: { lat: orgData.lat, lon: orgData.lon },
      type: QueryTypes.SELECT,
    });
    const point = QueryResultSchema.parse(pointQueryResult);
    return point[0].point;
  }
  return;
}

const createCQDirectoryEntries = async (orgDataArray: CQDirectoryEntryData[]): Promise<void> => {
  for (const orgData of orgDataArray) {
    const point = await computeEarthPoint(orgData);
    orgData.point = point;
  }

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

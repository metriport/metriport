import { Sequelize } from "sequelize";
import { z } from "zod";
import { CQDirectoryEntry, CQDirectoryEntryData } from "../../../domain/medical/cq-directory";
import { CQDirectoryEntryModel } from "../../../models/medical/cq-directory";
import { Config } from "../../../shared/config";
import {
  getCQDirectoryEntriesIdsAndLastUpdated,
  getCQDirectoryEntry,
} from "./get-cq-directory-entry";
import { updateCQDirectoryEntry } from "./update-cq-directory-entry";

const QueryResultSchema = z.object({
  point: z.string(),
});
const sqlDBCreds = Config.getDBCreds();
const dbCreds = JSON.parse(sqlDBCreds);

const sequelize = new Sequelize(dbCreds.dbname, dbCreds.username, dbCreds.password, {
  host: dbCreds.host,
  port: dbCreds.port,
  dialect: dbCreds.engine,
});

export type CQOrganizationCreateResponse = { org: CQDirectoryEntry } & { updated: boolean };
export type CQOrganizatioBulkCreateResponse = { updated: number; added: number };
export type CQDirectoryEntryDataWithUpdateAndId = CQDirectoryEntryData & {
  update?: boolean;
  new?: boolean;
};

export const createOrUpdateCQDirectoryEntry = async (
  orgData: CQDirectoryEntryData
): Promise<CQOrganizationCreateResponse> => {
  const existingOrg = await getCQDirectoryEntry({ oid: orgData.oid });
  if (existingOrg) {
    const updOrg = await updateCQDirectoryEntry({ ...orgData, id: existingOrg.id });
    return { org: updOrg, updated: true };
  }

  const org = await createCQDirectoryEntry(orgData);
  return { org, updated: false };
};

const createCQDirectoryEntry = async (orgData: CQDirectoryEntryData): Promise<CQDirectoryEntry> => {
  return await CQDirectoryEntryModel.create(orgData);
};

export const createOrUpdateCQDirectoryEntries = async (
  orgDataArray: CQDirectoryEntryDataWithUpdateAndId[]
): Promise<CQOrganizatioBulkCreateResponse> => {
  const oids = orgDataArray.map(data => data.oid);
  const existingEntries = await getCQDirectoryEntriesIdsAndLastUpdated(oids); // TODO: could parallelize this

  orgDataArray.forEach(orgData => {
    const existingEntry = existingEntries.find(entry => entry.oid === orgData.oid);
    if (existingEntry) {
      const latestVersion = existingEntry.lastUpdated === orgData.lastUpdated;
      if (!latestVersion) {
        orgData.id = existingEntry.id;
        orgData.update = true;
      }
    } else {
      orgData.new = true;
    }
  });

  const newEntries = orgDataArray.filter(org => org.new);
  const numNewEntries = newEntries.length;

  const updEntries = orgDataArray.filter(org => org.update);
  const numUpdEntries = updEntries.length;

  if (numNewEntries) await createCQDirectoryEntries(newEntries);
  if (numUpdEntries) await updateCQDirectoryEntries(updEntries);

  return { added: numNewEntries, updated: numUpdEntries };
};

async function computeEarthPoint(orgData: CQDirectoryEntryData): Promise<string | undefined> {
  if (orgData.lat && orgData.lon) {
    const pointQueryResult = await CQDirectoryEntryModel.findOne({
      attributes: [[sequelize.fn("ll_to_earth", orgData.lat, orgData.lon), "point"]],
      raw: true,
    });
    const point = QueryResultSchema.parse(pointQueryResult);
    return point.point;
  }
  return;
}

const createCQDirectoryEntries = async (orgDataArray: CQDirectoryEntryData[]): Promise<void> => {
  await Promise.all(
    orgDataArray.map(async orgData => {
      orgData.point = await computeEarthPoint(orgData);
    })
  );

  await CQDirectoryEntryModel.bulkCreate(orgDataArray);
};

const updateCQDirectoryEntries = async (
  updateEntries: CQDirectoryEntryDataWithUpdateAndId[]
): Promise<void> => {
  await Promise.allSettled(
    updateEntries.map(async entry => {
      await CQDirectoryEntryModel.update(entry, {
        where: { id: entry.id },
        returning: true,
      });
    })
  );
};

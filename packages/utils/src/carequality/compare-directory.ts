import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { Organization } from "@medplum/fhirtypes";
import { sleep } from "@metriport/shared";
import { JSONParser, ParsedElementInfo } from "@streamparser/json";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import fs from "fs";
import { groupBy } from "lodash";
import { elapsedTimeAsStr } from "../shared/duration";

dayjs.extend(duration);

/**
 * Compares the raw CQ directory with the one from the DB.
 *
 * Update the paths to the files downloaded from CQ and DB.
 *
 * Run the script with `ts-node src/carequality/compare-directory.ts`
 */

// File dowloaded from CQ, see download-directory.ts
const rawCqDirectoryPath = "";
/*
 File downloaded from DB, JSON file w/ the structure: CQDirectoryEntryData2[][]
 Adjust the code as needed, if you export directly from Postgres.
*/
const cqDirectoryFromDbPath = "";

export type CQDirectoryEntryData2 = {
  id: string; // Organization's OID
  name?: string;
  urlXCPD?: string;
  urlDQ?: string;
  urlDR?: string;
  lat?: number;
  lon?: number;
  addressLine?: string;
  city?: string;
  state?: string;
  zip?: string;
  data?: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  point?: string;
  rootOrganization?: string;
  managingOrganizationId?: string;
  active: boolean;
  lastUpdatedAtCQ: string;
};

async function main() {
  await sleep(50); // Give some time to avoid mixing logs w/ Node's
  const startedAt = Date.now();
  console.log(`############## Started at ${new Date(startedAt).toISOString()} ##############`);

  console.log("Loading raw CQ directory...");

  const rawCqDirectoryIds: string[] = [];
  async function loadRawCqDirectory() {
    await loadDataFromLargeJsonFile(rawCqDirectoryPath, ({ value }) => {
      const org = value as unknown as Organization;
      org.id && rawCqDirectoryIds.push(org.id);
    });
    console.log(`Done loading raw CQ directory, found ${rawCqDirectoryIds.length} entries`);
  }

  const cqDirectoryFromDbIds: string[] = [];
  async function loadCqDirectoryFromDb() {
    await loadDataFromLargeJsonFile(cqDirectoryFromDbPath, ({ value }) => {
      const orgs = value as unknown as CQDirectoryEntryData2[];
      orgs.forEach(org => org.id && cqDirectoryFromDbIds.push(org.id));
    });
    console.log(`Done loading CQ directory from DB, found ${cqDirectoryFromDbIds.length} entries`);
  }

  await Promise.all([loadRawCqDirectory(), loadCqDirectoryFromDb()]);
  console.log("Done loading, now comparing...");

  const duplicateRawIds = Object.entries(groupBy(rawCqDirectoryIds, id => id))
    .filter(v => v[1].length > 1)
    .flatMap(v => v[0]);
  const duplicateDbIds = Object.entries(groupBy(cqDirectoryFromDbIds, id => id))
    .filter(v => v[1].length > 1)
    .flatMap(v => v[0]);

  console.log(`Duplicate IDs in raw directory (count ${duplicateRawIds.length}):`, duplicateRawIds);
  console.log(`Duplicate IDs in DB (count ${duplicateDbIds.length}):`, duplicateDbIds);

  const rawIds = new Set(rawCqDirectoryIds);
  const dbIds = new Set(cqDirectoryFromDbIds);

  const onlyInRaw = [...rawIds].filter(id => id && !dbIds.has(id));
  const onlyInDb = [...dbIds].filter(id => id && !rawIds.has(id));
  const inBoth = [...rawIds].filter(id => id && dbIds.has(id));

  console.log("Only in raw directory:", onlyInRaw.length);
  console.log("Only in DB:", onlyInDb.length);
  console.log("In both:", inBoth.length);

  console.log(`>>>>>>> Done after ${elapsedTimeAsStr(startedAt)}`);
}

async function loadDataFromLargeJsonFile(
  path: string,
  onValue: (value: ParsedElementInfo.ParsedElementInfo) => void
): Promise<void> {
  const parser = new JSONParser({ stringBufferSize: undefined, paths: ["$.*"] });
  parser.onValue = onValue;
  await new Promise((resolve, reject) => {
    const inputStream = fs.createReadStream(path, { encoding: "utf8" });
    inputStream.on("error", reject);
    parser.onError = reject;
    parser.onEnd = () => resolve(undefined);
    inputStream.on("data", chunk => parser.write(chunk));
    inputStream.on("end", () => parser.end());
  });
}

if (require.main === module) {
  main();
}

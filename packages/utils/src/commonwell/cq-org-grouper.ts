import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { getOrgs } from "@metriport/core/external/commonwell/cq-bridge/get-orgs";
import fs from "fs";
import { orderBy } from "lodash";

/**
 * Script to group CQ orgs so we can process them externally
 */

const csvHeader = "id\tname\t# of states\n";
const csvName = `./cq-orgs.csv`;

function initCsv() {
  fs.writeFileSync(csvName, csvHeader);
}

function toStr(v: string) {
  return v ? v.trim().replaceAll("\t", " ") : "";
}

export async function main() {
  console.log(`Runnning at ${new Date().toISOString()}`);

  initCsv();

  const orgs = await getOrgs();
  console.log(`Found ${orgs.length} orgs`);

  orderBy(orgs, o => o.States.length, "desc").forEach(o => {
    fs.appendFileSync(csvName, `${toStr(o.Id)}\t${toStr(o.Name)}\t${o.States.length}\n`);
  });

  console.log(`Done at ${new Date().toISOString()}`);
}

main();

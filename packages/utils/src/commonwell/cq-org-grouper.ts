import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { getOrgs } from "@metriport/core/external/commonwell/cq-bridge/get-orgs";
import fs from "fs";
import { orderBy } from "lodash";
import originalPayloadFromCW from "./cq-org-list-original.json";

/**
 * Script to group CQ orgs so we can process them externally
 */

const orgsCSVHeader = "id\tname\t# of states\tgateway\n";
const orgsCSVName = `./cq-orgs.csv`;

const gwCSVHeader = "id\tgateway\t# of orgs\n";
const gwCSVName = `./cq-orgs-by-gateway.csv`;

function initCSVs() {
  fs.writeFileSync(orgsCSVName, orgsCSVHeader);
  fs.writeFileSync(gwCSVName, gwCSVHeader);
}

function toStr(v: string) {
  return v ? v.trim().replaceAll("\t", " ") : "";
}

export async function main() {
  console.log(`Runnning at ${new Date().toISOString()}`);

  initCSVs();

  const orgs = getOrgs();
  console.log(`Found ${orgs.length} orgs`);

  const gateways = originalPayloadFromCW;

  orderBy(gateways, o => o.Organizations.length, "desc").forEach(o => {
    fs.appendFileSync(gwCSVName, `${toStr(o.Id)}\t${toStr(o.Name)}\t${o.Organizations.length}\n`);
  });

  orderBy(orgs, o => o.name.toLowerCase(), "asc").forEach(o => {
    const gateway = gateways.find(g => g.Organizations.find(o2 => o2.Id === o.id));
    fs.appendFileSync(
      orgsCSVName,
      `${toStr(o.id)}\t${toStr(o.name)}\t${o.states.length}\t${gateway?.Name}\n`
    );
  });

  console.log(`Saved orgs CSV to ${orgsCSVName}`);
  console.log(`Saved gateways CSV to ${gwCSVName}`);

  console.log(`Done at ${new Date().toISOString()}`);
}

main();

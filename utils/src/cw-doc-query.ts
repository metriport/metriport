import { APIMode, CommonWell, PurposeOfUse } from "@metriport/commonwell-sdk";
import * as fs from "fs";

/**
 * Utility to query CW to query documents using Metriport's CW SDK.
 *
 * Update the variables below and run `ts-node src/cw-doc-parse`
 */

const cert = fs.readFileSync("xxx", "utf8");
const privkey = fs.readFileSync("xxx", "utf8");
const npi = "xxx";
const orgName = "xxx";
const orgId = "xxx";
const patientId = `xxx`;
const apiMode = APIMode.production;

async function main() {
  const api = new CommonWell(cert, privkey, orgName, "urn:oid:" + orgId, apiMode);
  const base = {
    purposeOfUse: PurposeOfUse.TREATMENT,
    role: "ict",
    subjectId: `${orgName} System User`,
  };
  const queryMeta = {
    subjectId: base.subjectId,
    role: base.role,
    purposeOfUse: base.purposeOfUse,
    npi: npi,
  };

  console.log(`>>> Querying...`);
  const docs = await api.queryDocuments(queryMeta, `${patientId}%5E%5E%5Eurn%3aoid%3a${orgId}`);
  console.log(`>>> Response:`);
  console.log(JSON.stringify(docs, null, 2));
  console.log(`>>> Found ${docs.entry?.length} documents.`);
}

main();

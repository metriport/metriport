import * as fs from "fs";
import * as dotenv from "dotenv";
import { chunk } from "lodash";
import { getEnvVarOrFail } from "./shared/env";
import axios from "axios";

dotenv.config();
// Keep dotenv import and config before everything else

const apiLbUrl = getEnvVarOrFail("API_LB_URL");
const CQ_ORG_CHUNK_SIZE = 50;

type SimpleOrg = {
  Id: string;
  Name: string;
  States: string[];
};

const cqOrgsList = fs.readFileSync("./cq-org-list.json", "utf8");
const basePortalUrl = "https://portal.commonwellalliance.org";

const cxId = "";
const orgOid = "";
const cookie = "";

// If it fails, change the index to the last one that was successful
const downloadProgressIndex = 0;

async function main() {
  const orgs: SimpleOrg[] = JSON.parse(cqOrgsList);

  const chunks = chunk(orgs, CQ_ORG_CHUNK_SIZE);

  chunks.splice(0, downloadProgressIndex);

  for (const [i, orgChunk] of chunks.entries()) {
    const orgIds = orgChunk.map(org => org.Id);

    console.log("ORG CHUNK", i + 1, chunks.length);

    try {
      const resp = await axios.post(
        `${basePortalUrl}/Organization/${orgOid}/IncludeList`,
        {
          LocalOrganizationid: orgOid,
          IncludedOrganizationIdList: orgIds,
        },
        {
          timeout: 60000,
          headers: {
            Cookie: cookie,
            "User-Agent":
              "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36",
            Accept: "application/json, text/plain, */*",
            Origin: `${basePortalUrl}`,
            Referer: `${basePortalUrl}/Organization/${orgOid}/IncludeList/Edit`,
          },
        }
      );

      if (resp.data["SelectedOrganizationList"]) {
        console.log("RESPONSE", JSON.stringify(resp.data["SelectedOrganizationList"], null, 2));
      } else {
        throw new Error(`Bad resp`);
      }
    } catch (error) {
      console.log(`ERROR - stopped at org chunk ${i + downloadProgressIndex}`, error);
      throw error;
    }

    await axios.post(`${apiLbUrl}/internal/patient/update-all?cxId=${cxId}`);

    await sleep(5000);
  }
}

main();

const sleep = (timeInMs: number) => new Promise(resolve => setTimeout(resolve, timeInMs));

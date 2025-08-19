import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import {
  CQOrg,
  CQOrgHydrated,
  getOrgs,
  OrgPrio,
} from "@metriport/core/external/commonwell/cq-bridge/get-orgs";
import { executeAsynchronously } from "@metriport/core/util/concurrency";
import { getEnvVarOrFail } from "@metriport/core/util/env-var";
import { executeWithNetworkRetries } from "@metriport/shared";
import { errorToString } from "@metriport/shared/common/error";
import axios from "axios";
import { Command } from "commander";
import fs from "fs";
import { uniq } from "lodash";
import { uuidv4 } from "../shared/uuid-v7";
import { priorityOrgs } from "./cq-org-list-by-prio";
import originalPayloadFromCW from "./cq-org-list-original.json";
import { Gateway } from "./cq-org-types";

/**
 * Script to hydrate CW's list of CQ orgs w/ US states from the Sequoia API.
 * Overwrites the file `cq-org-list.json` in the core package.
 *
 * Run with `--local` if you just want to update the list based on `priorityOrgs`.
 *
 * Update the `priorityOrgs` on the external file, adding Org OIDs to the respective priority array.
 * Update `excludeGatewayNames` w/ the list of gateways to exclude all its orgs from the list.
 * Set the required env vars if you want to run it against the Sequoia API.
 */

const resultFilename = `../../packages/core/src/external/commonwell/cq-bridge/cq-org-list.json`;
const outputFailedFilename = `./runs/cq-org-builder.failed`;

const sequoiaApiKey = getEnvVarOrFail("SEQUOIA_API_KEY");
const sequoiaQueryURL = `https://wpapi.sequoiaproject.org/fhir-stu3/1.0.0/Organization`;

const excludeGatewayNames = [
  // The Surescripts Record Locator Gateway is automatically included in every Outbound XCPD transaction,
  // so it does allow you to search through all Surescripts orgs.
  // https://metriport.slack.com/archives/C04DMKE9DME/p1700501978325669?thread_ts=1700077189.772289&cid=C04DMKE9DME
  "Surescripts",
];

const RADIUS_FOR_SEQUOIA_QUERY = 30;
type OrgWithGateway = CQOrg & { gateway: string };

type Params = {
  local?: boolean;
};
const program = new Command();
program
  .name("cq-org-builder")
  .description("CLI to rebuild the CW's CQ org list.")
  .option(
    `--local`,
    "Rebuild the lisf from the local file without calling the Sequoia API (does not update the list of US states"
  )
  .showHelpAfterError();

export async function main() {
  program.parse();
  const { local: isLocal } = program.opts<Params>();

  console.log(`Runnning at ${new Date().toISOString()} - local: ${isLocal}`);

  fs.writeFileSync(outputFailedFilename, "");

  const gateways = originalPayloadFromCW as Gateway[];
  console.log(`I have ${gateways.length} gateways on the original list...`);
  const gatewaysToProcess = gateways.filter(g => !excludeGatewayNames.includes(g.Name));
  console.log(
    `...processing ${gatewaysToProcess.length} gateways (exclude list has ${excludeGatewayNames.length} items)`
  );

  const totalFailed: { gateway: string; reason: string }[] = [];
  const flatOrgs: CQOrgHydrated[] = [];
  for (const gateway of gatewaysToProcess) {
    const orgs: OrgWithGateway[] = gateway.Organizations.map(o => {
      return { id: o.Id, name: o.Name, gateway: gateway.Name };
    });
    const success: string[] = [];
    const failed: string[] = [];
    await executeAsynchronously(
      orgs,
      async org => {
        try {
          const states: string[] = isLocal
            ? await getStatesFromCurrent(org.id)
            : await getOrgStatesFromSequoia(org.id);
          flatOrgs.push({ ...org, states: states, prio: getPrio(org) });
          success.push(org.id);
        } catch (error) {
          console.log(`Error processing org ${org.id}: ${error}`);
          failed.push(errorToString(error));
          throw error;
        }
      },
      { numberOfParallelExecutions: 100, keepExecutingOnError: true }
    );
    console.log(
      `--------------> Done w/ orgs of GW ${gateway.Name}: ${success.length} succeeded, ${failed.length} failed`
    );
    if (failed.length) {
      fs.appendFileSync(outputFailedFilename, JSON.stringify(failed, null, 2));
      const errorsOnThisGW = uniq(failed);
      totalFailed.push(...errorsOnThisGW.map(err => ({ gateway: gateway.Name, reason: err })));
    }
  }
  fs.writeFileSync(resultFilename, JSON.stringify(flatOrgs, null, 2));

  console.log(`Saved flat org list to ${resultFilename}`);

  console.log(`Failed`, totalFailed);

  console.log(`Done at ${new Date().toISOString()}`);
}

async function getInfo(url: string) {
  return executeWithNetworkRetries(() => axios.get(url), {
    maxAttempts: 6,
    initialDelay: 500,
    retryOnTimeout: true,
  });
}

async function getOrgStatesFromSequoia(orgOID: string): Promise<string[]> {
  if (!orgOID) return [];

  const params = new URLSearchParams([
    ["_id", orgOID],
    ["_radius", String(RADIUS_FOR_SEQUOIA_QUERY)],
    ["_sort", "orgname"],
    ["_active", "true"],
    ["apikey", sequoiaApiKey],
  ]);
  const url = `${sequoiaQueryURL}?${params.toString()}`;

  const resp = await getInfo(url);
  if (!resp) return [];

  const parsed: { name: string; state: string | undefined }[] = resp.data.Bundle?.entry?.map(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (e: any) => ({
      name: e.resource?.Organization?.name?.value ?? uuidv4(),
      state: e.resource?.Organization?.address?.state?.value,
    })
  );
  const states: string[] = [];
  for (const p of parsed) {
    if (p.state) states.push(p.state);
  }
  console.log(`Got these states for org ${orgOID}: ${states.join(", ")}`);
  return states;
}

async function getStatesFromCurrent(orgOID: string): Promise<string[]> {
  const states = getOrgs().find(o => o.id === orgOID)?.states ?? [];
  console.log(`(local) Got these states for org ${orgOID}: ${states.join(", ")}`);
  return states;
}

function getPrio(org: OrgWithGateway): OrgPrio {
  if (priorityOrgs.high.includes(org.id)) return "high";
  if (priorityOrgs.medium.includes(org.id)) return "medium";
  return "low";
}

main();

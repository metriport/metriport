import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { FacilityInternalDetails } from "@metriport/core/domain/facility";
import { sleep, USTerritory, USState } from "@metriport/shared";
import { getEnvVarOrFail } from "@metriport/shared/common/env-var";
import axios from "axios";
import dayjs, { duration } from "dayjs";
import {
  getCqFacilitySafe,
  getCwFacilitySafe,
  getInternalFacilityByNpi,
  readNpisFromCsv,
} from "./utils";
import { Command } from "commander";
import { InternalFacilityDTO } from "../../../api/src/routes/medical/dtos/facilityDTO";

dayjs.extend(duration);
/**
 * Bulk creates facilities in CareQuality and CommonWell.
 *
 * Reads facilities in bulk from a CSV file containing NPIs.
 * Syncs the facilities with CareQuality and CommonWell, creating them if they don't exist.
 *
 * Logs the result of processing to the console.
 *
 * Set the variables below to configure the script.
 *
 * Usage:
 * $ ts-node src/facility/sync-facilities --input-path <inputpath> --cx-id <cxId>
 */

const internalUrl = getEnvVarOrFail("API_URL");

// There are 3 sleeps so the time it takes to sync a single NPI is slightly longer than waitTimeBetweenChecks * 3.
// Each sleep is after each API call to CQ and CW.
const waitTimeBetweenChecks = dayjs.duration(0.5, "seconds");

interface FacilitySyncParams {
  inputPath: string;
  cxId: string;
}

async function main({ inputPath, cxId }: FacilitySyncParams) {
  const npis = await readNpisFromCsv(inputPath);
  const cwFound: string[] = [];
  const cwNotFound: string[] = [];
  const cqFound: string[] = [];
  const cqNotFound: string[] = [];
  const noOid: string[] = [];
  const facilityNotFound: string[] = [];
  const synced: string[] = [];
  const syncFailed: string[] = [];

  for (const npi of npis) {
    console.log(`Processing facility: ${npi}`);
    let facility: InternalFacilityDTO | undefined = undefined;
    try {
      facility = await getInternalFacilityByNpi(cxId, npi);
    } catch (error) {
      facilityNotFound.push(npi);
      console.log(error);
      continue;
    }
    if (!facility) {
      console.log(`Facility not found in DB: ${npi}`);
      facilityNotFound.push(npi);
      continue;
    }

    const facilityOid = facility.oid;
    if (!facilityOid) {
      console.log(`Facility has no OID: ${npi}`);
      noOid.push(npi);
      continue;
    }

    const [cwOrg, cqOrg] = await Promise.all([
      getCwFacilitySafe(cxId, facility.id, facilityOid),
      getCqFacilitySafe(cxId, facility.id, facilityOid),
    ]);
    await sleep(waitTimeBetweenChecks.asMilliseconds());

    if (cwOrg) cwFound.push(npi);
    else cwNotFound.push(npi);

    if (cqOrg) cqFound.push(npi);
    else cqNotFound.push(npi);

    if (cwOrg && cqOrg && cwOrg.active && cqOrg.active) {
      console.log(`Facility is active in both CW and CQ`);
      synced.push(npi);
      continue;
    }
    console.log(`Syncing facility: ${npi}`);

    const cleanNameInMetriport = facility.name.replace(/&/g, "and");

    const facilityDetails: FacilityInternalDetails = {
      id: facility.id,
      nameInMetriport: cleanNameInMetriport,
      npi: facility.npi,
      tin: facility.tin || undefined,
      addressLine1: facility.address.addressLine1,
      addressLine2: facility.address.addressLine2,
      city: facility.address.city,
      state: facility.address.state as USState | USTerritory,
      zip: facility.address.zip,
      country: "USA",
      cqActive: facility.cqActive,
      cwActive: facility.cwActive,
      ehexActive: facility.ehexActive,
      cqApproved: facility.cqApproved,
      cwApproved: facility.cwApproved,
      ehexApproved: facility.ehexApproved,
      type: facility.type,
      principalOid: facility.principalOid || undefined,
    };

    try {
      await axios.put(`${internalUrl}/internal/facility?cxId=${cxId}`, facilityDetails, {
        headers: {
          "Content-Type": "application/json",
        },
      });
      // Internal PUT calls CQ and CW. That's why we are sleeping here.
      await sleep(waitTimeBetweenChecks.asMilliseconds());
      console.log(`Ran facility sync: ${npi}`);

      const [cqOrgAfter, cwOrgAfter] = await Promise.all([
        getCqFacilitySafe(cxId, facility.id, facilityOid),
        getCwFacilitySafe(cxId, facility.id, facilityOid),
      ]);
      await sleep(waitTimeBetweenChecks.asMilliseconds());

      if (cqOrgAfter && cwOrgAfter && cqOrgAfter.active && cwOrgAfter.active) {
        console.log(`Facility successfully synced: ${npi}`);
        synced.push(npi);
      } else {
        console.log(`Facility failed to sync: ${npi}`);
        syncFailed.push(npi);
      }
    } catch (error) {
      syncFailed.push(npi);
      console.log(error);
    }
  }

  const brokenFacilities = new Set([...cwNotFound, ...cqNotFound]).size;
  const fixedFacilities = synced.length;

  console.log("\n" + "=".repeat(60));
  console.log("FACILITY SYNC RESULTS");
  console.log("=".repeat(60));
  console.log(`Total facilities processed: ${npis.length}`);
  console.log(`Broken facilities found: ${brokenFacilities}`);
  console.log(`Facilities successfully fixed: ${fixedFacilities}`);
  console.log(`Facilities that failed to fix: ${syncFailed.length}`);
  console.log(`Facilities skipped (no OID): ${noOid.length}`);
  console.log(`Facilities not found: ${facilityNotFound.length}`);

  if (brokenFacilities > 0) {
    console.log(
      `\nOriginally Broken NPIs: ${[...new Set([...cwNotFound, ...cqNotFound])].join(", ")}`
    );
  }
  if (fixedFacilities > 0) {
    console.log(`\nFixed NPIs: ${synced.join(", ")}`);
  }
  if (syncFailed.length > 0) {
    console.log(`\nFailed to fix NPIs: ${syncFailed.join(", ")}`);
  }
}

const program = new Command();

program
  .name("sync-facilities")
  .requiredOption("--input-path <inputpath>", "The path to the input csv file")
  .requiredOption("--cx-id <cxId>", "The customer ID for the facilities to be created under.")
  .description("Syncs the facilities with CommonWell and CareQuality.")
  .showHelpAfterError()
  .version("1.0.0")
  .action(main);

if (require.main === module) {
  program.parse(process.argv);
}
export default program;

import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { sleep } from "@metriport/shared";
import { getFacilityByNpi } from "./bulk-import-facility";
import { getCqFacility, getCwFacility, readNpisFromCsv } from "./utils";
import dayjs from "dayjs";

/*
 * This script will read NPIs from a local csv.
 * It will check if the facility is present in CommonWell and CareQuality.
 *
 * It console logs the result of processing.
 *
 * Format of the .csv file:
 * - first line contains column name: npi
 * - minimum columns: npi
 *
 * Set the API_URL env var.
 * Set the input variables below.
 *
 * Execute this with:
 * $ ts-node src/facility/check-facilities
 */

const cxId = "";
const inputPath = "";
const timeout = dayjs.duration(1, "seconds");

async function main() {
  console.log("Starting facility assessment...");

  try {
    const npis = await readNpisFromCsv(inputPath);
    console.log(`Found ${npis.length} NPIs to assess`);

    const cwFound: string[] = [];
    const cwNotFound: string[] = [];
    const cqFound: string[] = [];
    const cqNotFound: string[] = [];
    const noOid: string[] = [];
    const facilityNotFound: string[] = [];

    for (const npi of npis) {
      console.log(`Checking facility with NPI: ${npi}`);
      const facility = await getFacilityByNpi(cxId, npi);
      if (!facility) {
        console.log(`❌ Facility not found: ${npi}`);
        facilityNotFound.push(npi);
        continue;
      }
      //eslint-disable-next-line @typescript-eslint/no-explicit-any
      const facilityOid = (facility as any).oid;
      if (!facilityOid) {
        console.log(`⚠️  Facility has no OID, skipping HIE checks`);
        noOid.push(npi);
        continue;
      }

      try {
        console.log(`Checking CommonWell organization for OID: ${facilityOid}`);
        const cwOrg = await getCwFacility(cxId, facility.id, facilityOid);
        console.log(`✅ CW Organization found: ${cwOrg.id}`);
        cwFound.push(npi);
      } catch (error) {
        console.log(`❌ CW Organization not found: ${error}`);
        cwNotFound.push(npi);
      }

      try {
        console.log(`Checking CareQuality organization for OID: ${facilityOid}`);
        const cqOrg = await getCqFacility(cxId, facility.id, facilityOid);
        console.log(`✅ CQ Organization found: ${cqOrg.id})}`);
        cqFound.push(npi);
      } catch (error) {
        console.log(`❌ CQ Organization not found: ${error}`);
        cqNotFound.push(npi);
      }

      await sleep(timeout.asMilliseconds());
    }

    console.log("\n" + "=".repeat(60));
    console.log("HIE NETWORK ASSESSMENT SUMMARY");
    console.log("=".repeat(60));
    console.log(`Total NPIs processed: ${npis.length}`);
    console.log(`\nCOMMONWELL (CW):`);
    console.log(`  Found in CW: ${cwFound.length} NPIs`);
    console.log(`  Not found in CW: ${cwNotFound.length} NPIs`);
    console.log(`\nCAREQUALITY (CQ):`);
    console.log(`  Found in CQ: ${cqFound.length} NPIs`);
    console.log(`  Not found in CQ: ${cqNotFound.length} NPIs`);
    console.log(`\nOTHER:`);
    console.log(`  Facility not found in Metriport: ${facilityNotFound.length} NPIs`);
    console.log(`  No OID (skipped HIE checks): ${noOid.length} NPIs`);

    if (cwFound.length > 0) {
      console.log(`\n✅ CW FOUND NPIs: ${cwFound.join(", ")}`);
    }
    if (cwNotFound.length > 0) {
      console.log(`\n❌ CW NOT FOUND NPIs: ${cwNotFound.join(", ")}`);
    }
    if (cqFound.length > 0) {
      console.log(`\n✅ CQ FOUND NPIs: ${cqFound.join(", ")}`);
    }
    if (cqNotFound.length > 0) {
      console.log(`\n❌ CQ NOT FOUND NPIs: ${cqNotFound.join(", ")}`);
    }
    if (facilityNotFound.length > 0) {
      console.log(`\n⚠️  FACILITY NOT FOUND NPIs: ${facilityNotFound.join(", ")}`);
    }
    if (noOid.length > 0) {
      console.log(`\n⚠️  NO OID NPIs: ${noOid.join(", ")}`);
    }
  } catch (error) {
    console.error("Error during assessment:", error);
    throw error;
  }
}

main();

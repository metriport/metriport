import { Facility } from "@metriport/api-sdk/medical/models/facility";
import { FacilityType } from "@metriport/core/domain/facility";
import { sleep } from "@metriport/shared";
import { getEnvVarOrFail } from "@metriport/shared/common/env-var";
import axios from "axios";
import dayjs from "dayjs";
import { FacilityInternalDetails } from "../../../api/src/routes/medical/schemas/facility";
import { getFacilityByNpi } from "./bulk-import-facility";
import { getCqFacilitySafe, getCwFacilitySafe, readNpisFromCsv } from "./utils";

/*
 * This script will read NPIs from a local csv.
 * It will try to sync the facility with CommonWell and CareQuality if it's not already there.
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
 * $ ts-node src/facility/sync-facilities
 */

const cxId = "";
const inputPath = "";
const internalUrl = getEnvVarOrFail("API_URL");
const defaultActive = true;
const defaultType = FacilityType.initiatorAndResponder;
const timeout = dayjs.duration(0.5, "seconds");

async function main() {
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
    let facility: Facility | null = null;
    try {
      facility = await getFacilityByNpi(cxId, npi);
    } catch (error) {
      facilityNotFound.push(npi);
      continue;
    }
    if (!facility) {
      console.log(`Facility not found: ${npi}`);
      facilityNotFound.push(npi);
      continue;
    }
    //eslint-disable-next-line @typescript-eslint/no-explicit-any
    const facilityOid = (facility as any).oid;
    if (!facilityOid) {
      console.log(`Facility has no OID: ${npi}`);
      noOid.push(npi);
      continue;
    }

    const cwOrg = await getCwFacilitySafe(cxId, facility.id, facilityOid);
    const cqOrg = await getCqFacilitySafe(cxId, facility.id, facilityOid);

    if (cwOrg) cwFound.push(npi);
    else cwNotFound.push(npi);

    if (cqOrg) cqFound.push(npi);
    else cqNotFound.push(npi);

    if (cwOrg && cqOrg && cwOrg.active && cqOrg.active) {
      console.log(`Facility is active in both CW and CQ`);
      continue;
    }
    console.log(`Syncing facility`);

    const facilityDetails: FacilityInternalDetails = {
      id: facility.id,
      nameInMetriport: facility.name,
      npi: facility.npi,
      tin: facility.tin || undefined,
      addressLine1: facility.address.addressLine1,
      addressLine2: facility.address.addressLine2,
      city: facility.address.city,
      state: facility.address.state,
      zip: facility.address.zip,
      country: facility.address.country,
      cqType: defaultType,
      cwType: defaultType,
      cqActive: defaultActive,
      cwActive: defaultActive,
      cqApproved: defaultActive,
      cwApproved: defaultActive,
    };

    try {
      await axios.put(`${internalUrl}/internal/facility?cxId=${cxId}`, facilityDetails, {
        headers: {
          "Content-Type": "application/json",
        },
      });
      console.log(`Ran facility sync: ${npi}`);
      await sleep(timeout.asMilliseconds());

      const cqOrgAfter = await getCqFacilitySafe(cxId, facility.id, facilityOid);
      const cwOrgAfter = await getCwFacilitySafe(cxId, facility.id, facilityOid);

      if (cqOrgAfter && cwOrgAfter && cqOrgAfter.active && cwOrgAfter.active) {
        console.log(`Facility successfully synced`);
        synced.push(npi);
      } else {
        console.log(`Facility failed to sync`);
        syncFailed.push(npi);
      }
    } catch (error) {
      syncFailed.push(npi);
      console.log(error);
    }

    await sleep(timeout.asMilliseconds());
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
    console.log(`\nBroken NPIs: ${[...new Set([...cwNotFound, ...cqNotFound])].join(", ")}`);
  }
  if (fixedFacilities > 0) {
    console.log(`\nFixed NPIs: ${synced.join(", ")}`);
  }
  if (syncFailed.length > 0) {
    console.log(`\nFailed to fix NPIs: ${syncFailed.join(", ")}`);
  }
}

main();

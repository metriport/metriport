import { MetriportError, sleep } from "@metriport/shared";
import { getEnvVarOrFail } from "@metriport/shared/common/env-var";
import axios from "axios";
import csvParser from "csv-parser";
import { createReadStream, constants as FS } from "node:fs";
import { access } from "node:fs/promises";
import { pipeline } from "node:stream/promises";
import path from "path";
import { InternalFacilityDTO } from "../../../api/src/routes/medical/dtos/facilityDTO";
import { Writable } from "node:stream";
import fs from "fs/promises";

const internalUrl = getEnvVarOrFail("API_URL");

interface NpiRow {
  npi: string;
}

//eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getCwFacility(cxId: string, id: string, oid: string): Promise<any> {
  const resp = await axios.get(
    internalUrl + `/internal/commonwell/ops/organization/${oid}?facilityId=${id}&cxId=${cxId}`
  );
  if (!resp.data) throw new Error(`CW Organization not returned`);
  return resp.data;
}

//eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getCqFacility(cxId: string, id: string, oid: string): Promise<any> {
  const resp = await axios.get(
    internalUrl +
      `/internal/carequality/ops/directory/organization/${oid}?facilityId=${id}&cxId=${cxId}`
  );
  if (!resp.data) throw new Error(`CQ Organization not returned`);
  return resp.data;
}

export async function readNpisFromCsv(inputPath: string): Promise<string[]> {
  const npis: string[] = [];

  const parser = csvParser({
    headers: ["npi"],
    skipLines: 1,
  });

  parser.on("data", (row: NpiRow) => {
    if (row.npi && row.npi.trim()) {
      npis.push(row.npi.trim());
    }
  });

  const filePath = path.resolve(inputPath);

  try {
    await access(filePath, FS.R_OK);
  } catch {
    throw new MetriportError("File does not exist or is not readable.", undefined, {
      inputPath: filePath,
    });
  }

  await new Promise<void>((resolve, reject) => {
    parser.once("end", resolve);
    parser.once("error", reject);
    pipeline(createReadStream(filePath), parser).catch(reject);
  });

  return npis;
}

export async function getCwFacilitySafe(
  cxId: string,
  id: string,
  oid: string
  //eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any | undefined> {
  try {
    return await getCwFacility(cxId, id, oid);
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      return undefined;
    }
    throw error;
  }
}

export async function getCqFacilitySafe(
  cxId: string,
  id: string,
  oid: string
  //eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any | undefined> {
  try {
    return await getCqFacility(cxId, id, oid);
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      return undefined;
    }
    throw error;
  }
}

/**
 * This function gets the facility from the internal API (NOT from CQ or CW).
 *
 * @param cxId - The CX ID.
 * @param npi - The NPI to get the facility for.
 * @returns The facility if found, undefined otherwise.
 */
export async function getInternalFacilityByNpi(
  cxId: string,
  npi: string
): Promise<InternalFacilityDTO | undefined> {
  try {
    const url = `${internalUrl}/internal/cx-data`;
    const response = await axios.get(url, {
      params: { cxId },
      headers: {
        "Content-Type": "application/json",
      },
    });
    const data = response.data;
    const facilities = data.facilities || [];
    const facility = facilities.find((f: InternalFacilityDTO) => f.npi === npi);
    return facility || undefined;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      return undefined;
    }
    throw error;
  }
}

/**
 * This function verifies the facilities exist in CommonWell and CareQuality.
 *
 * This function will do this in this order:
 * 1. Get the facility from the internal API.
 * 2. Get (verify) the facility exists in CommonWell and CareQuality.
 * 3. Log the result of the verification.
 *
 * @param npis - The NPIs to verify.
 * @param cxId - The CX ID.
 * @param timeout - The timeout in milliseconds.
 */
export async function verifyFacilities({
  npis,
  cxId,
  timeout,
}: {
  npis: string[];
  cxId: string;
  timeout: number;
}) {
  const notFound: string[] = [];
  const cwOrgNotFound: string[] = [];
  const cqOrgNotFound: string[] = [];
  const noOid: string[] = [];
  const cwOrgFound: string[] = [];
  const cqOrgFound: string[] = [];

  for (const npi of npis) {
    console.log(`Verifying facility: ${npi}`);

    const facility = await getInternalFacilityByNpi(cxId, npi);
    if (!facility) {
      console.log(`❌ Facility not found in internal DB: ${npi}`);
      notFound.push(npi);
      continue;
    }

    const facilityOid = facility.oid;
    if (!facilityOid) {
      console.log(`❌ Facility has no OID: ${npi}`);
      noOid.push(npi);
      continue;
    }

    const [cwOrg, cqOrg] = await Promise.all([
      getCwFacilitySafe(cxId, facility.id, facilityOid),
      getCqFacilitySafe(cxId, facility.id, facilityOid),
    ]);
    await sleep(timeout);

    if (!cwOrg) {
      console.log(`❌ CW Organization not found: ${npi}`);
      cwOrgNotFound.push(npi);
    } else {
      cwOrgFound.push(npi);
    }
    if (!cqOrg) {
      console.log(`❌ CQ Organization not found: ${npi}`);
      cqOrgNotFound.push(npi);
    } else {
      cqOrgFound.push(npi);
    }

    if (cwOrg && cqOrg && cwOrg.active && cqOrg.active) {
      console.log(`✅ Facility is active in both CW and CQ: ${npi}`);
    }
  }
  console.log("\n" + "=".repeat(60));
  console.log("FACILITY VERIFICATION RESULTS");
  console.log("=".repeat(60));
  if (notFound.length > 0) {
    console.log(`\nFacilities that never created: ${notFound}`);
  }
  if (cwOrgNotFound.length > 0) {
    console.log(`\n ❌ CW Organization not found: ${cwOrgNotFound}`);
  }
  if (cqOrgNotFound.length > 0) {
    console.log(`\n ❌ CQ Organization not found: ${cqOrgNotFound}`);
  }
  if (cwOrgFound.length > 0) {
    console.log(`\n ✅ CW Organization found: ${cwOrgFound}`);
  }
  if (cqOrgFound.length > 0) {
    console.log(`\n ✅ CQ Organization found: ${cqOrgFound}`);
  }
  if (noOid.length > 0) {
    console.log(`\nNo OID: ${noOid}`);
  }
  console.log(`Total facilities processed: ${npis.length}`);
}

export async function readFileFromLocal(inputPath: string, parser: Writable): Promise<void> {
  const filePath = path.resolve(inputPath);

  try {
    await access(filePath, FS.R_OK);
  } catch {
    throw new MetriportError("File does not exist or is not readable.", undefined, {
      inputPath: filePath,
    });
  }

  await pipeline(createReadStream(filePath), parser);
}

export async function createCsv(filePath: string, csvHeader: string): Promise<void> {
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });

  await fs.writeFile(filePath, csvHeader, "utf8");
}

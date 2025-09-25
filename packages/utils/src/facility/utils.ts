import { getEnvVarOrFail } from "@metriport/shared/common/env-var";
import { MetriportError } from "@metriport/shared";
import axios from "axios";
import { access } from "node:fs/promises";
import { pipeline } from "node:stream/promises";
import path from "path";
import { createReadStream, constants as FS } from "node:fs";
import csvParser from "csv-parser";
import { Facility as SdkFacility } from "@metriport/api-sdk/medical/models/facility";
import { sleep } from "@metriport/shared";

interface FacilityWithOid extends SdkFacility {
  oid: string;
}

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

export async function getInternalFacilityByNpi(
  cxId: string,
  npi: string
): Promise<FacilityWithOid | undefined> {
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
    const facility = facilities.find((f: FacilityWithOid) => f.npi === npi);
    return facility || undefined;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      return undefined;
    }
    throw error;
  }
}

export async function verifyFacilities(npis: string[], cxId: string, timeout: number) {
  const notFound: string[] = [];
  const cwOrgNotFound: string[] = [];
  const cqOrgNotFound: string[] = [];
  const noOid: string[] = [];
  const cwOrgFound: string[] = [];
  const cqOrgFound: string[] = [];

  for (const npi of npis) {
    const facility = await getInternalFacilityByNpi(cxId, npi);
    if (!facility) {
      console.log(`❌ Facility not found: ${npi}`);
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
    await sleep(timeout);
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

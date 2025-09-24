import { getEnvVarOrFail } from "@metriport/shared/common/env-var";
import { MetriportError } from "@metriport/shared";
import axios from "axios";
import { access } from "node:fs/promises";
import { pipeline } from "node:stream/promises";
import path from "path";
import { createReadStream, constants as FS } from "node:fs";
import csvParser from "csv-parser";

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
    headers: ["facilityName", "npi"],
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
): Promise<any | null> {
  try {
    return await getCwFacility(cxId, id, oid);
  } catch {
    return null;
  }
}

export async function getCqFacilitySafe(
  cxId: string,
  id: string,
  oid: string
  //eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any | null> {
  try {
    return await getCqFacility(cxId, id, oid);
  } catch {
    return null;
  }
}

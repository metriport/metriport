import * as dotenv from "dotenv";
dotenv.config();
// Keep dotenv import and config before everything else
import { getEnvVarOrFail } from "@metriport/core/util/env-var";
import axios, { AxiosError } from "axios";
import {
  Facility,
  facilitySchema,
  Organization,
  organizationSchema,
} from "../commonwell/org-migration/cw-v2-org-migration-utils";

const apiUrl = getEnvVarOrFail("API_URL");

export async function getCxData(
  cxId: string,
  facilityId?: string | undefined,
  includeFacility = true
): Promise<{
  facilityId: string | undefined;
  npi: string | undefined;
  orgName: string;
  orgOID: string;
}> {
  console.log(`>>> Getting customer data...`);

  const cxDataFull = await getCxDataFull(cxId);
  const org = cxDataFull.org;
  const facilities = cxDataFull.facilities;

  if (!org) throw new Error("No organization found");

  function getFacility(): Facility {
    if (!facilities || facilities.length < 1) throw new Error("No facility found");
    if (facilityId) {
      const facility = facilities.find(f => f.id === facilityId);
      if (!facility) throw new Error("No facility matching the provided ID was found");
      return facility;
    }
    if (facilities.length > 1) throw new Error("Got more than one facility - choose one");
    return facilities[0];
  }
  const facility = includeFacility ? getFacility() : undefined;

  const res = {
    facilityId: facility?.id,
    npi: facility?.npi,
    orgName: org.name,
    orgOID: org.oid,
  };

  return res;
}

export async function getCxDataFull(
  cxId: string
): Promise<{ org: Organization | undefined; facilities: Facility[] }> {
  try {
    const resp = await axios.get(apiUrl + "/internal/cx-data", { params: { cxId } });
    if (!resp.data) throw new Error(`Cx data not returned`);
    return {
      org: organizationSchema.parse(resp.data["org"]),
      facilities: resp.data["facilities"].map(facilitySchema.parse),
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    if (error instanceof AxiosError && error.response?.status === 404) {
      return { org: undefined, facilities: [] };
    }
    throw error;
  }
}

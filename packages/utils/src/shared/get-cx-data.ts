import * as dotenv from "dotenv";
dotenv.config();
// Keep dotenv import and config before everything else
import { Facility, Organization } from "@metriport/api-sdk";
import { getEnvVarOrFail } from "@metriport/core/util/env-var";
import axios from "axios";

const apiUrl = getEnvVarOrFail("API_URL");

// Write a function to get the env vars from the customer data using the api sdk
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

  const respCxData = await axios.get(apiUrl + "/internal/cx-data", {
    params: {
      cxId,
    },
  });
  console.log(`>>> Customer data retrieved:`, respCxData.data);

  const org: Organization | undefined = respCxData.data.org;
  const facilities: Facility[] | undefined = respCxData.data.facilities;

  if (!org) throw new Error("No organization found");
  if (!facilities) throw new Error("No organization found");

  const getFacility = async (): Promise<Facility> => {
    if (!facilities || facilities.length < 1) throw new Error("No facility found");
    if (facilityId) {
      const facility = facilities.find(f => f.id === facilityId);
      if (!facility) throw new Error("No facility matching the provided ID was found");
      return facility;
    }
    if (facilities.length > 1) throw new Error("Got more than one facility");
    return facilities[0];
  };
  const facility = includeFacility ? await getFacility() : undefined;

  const res = {
    facilityId: facility?.id,
    npi: facility?.npi,
    orgName: org.name,
    orgOID: org.oid,
  };

  return res;
}

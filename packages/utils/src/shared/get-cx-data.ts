import * as dotenv from "dotenv";
dotenv.config();
// Keep dotenv import and config before everything else
import { Facility, MetriportMedicalApi } from "@metriport/api-sdk";

// Write a function to get the env vars from the customer data using the api sdk
export async function getCxData(
  apiKey: string,
  facilityId?: string | undefined
): Promise<{ facilityId: string; npi: string; orgName: string; orgOID: string }> {
  console.log(`>>> Getting customer data...`);

  // get data from the api using the api-sdk
  const api = new MetriportMedicalApi(apiKey);
  const org = await api.getOrganization();
  if (!org) throw new Error("No organization found");

  const getFacility = async (): Promise<Facility> => {
    const facilities = await api.listFacilities();
    if (facilities.length < 1) throw new Error("No facility found");
    if (facilityId) {
      const facility = facilities.find(f => f.id === facilityId);
      if (!facility) throw new Error("No facility matching the provided ID was found");
      return facility;
    }
    if (facilities.length > 1) throw new Error("Got more than one facility");
    return facilities[0];
  };
  const facility = await getFacility();

  const res = {
    facilityId: facility.id,
    npi: facility.npi,
    orgName: org.name,
    orgOID: org.oid,
  };

  console.log(`>>> Customer data retrieved.`, res);
  return res;
}

import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ above all other imports
import { APIMode, CommonWell, Organization } from "@metriport/commonwell-sdk";
import { makeNPI } from "@metriport/shared/common/__tests__/npi";
import { existingOrgId, orgCertificateString, orgPrivateKeyString } from "../env";
import { initContributionHttpServer } from "../flows/contribution/contribution-server";

/**
 * Supporting function used to get a patient by ID.
 */
export async function main() {
  const organizationId = existingOrgId;
  if (!organizationId) throw new Error("Organization ID is required");
  const org: Pick<Organization, "name" | "organizationId" | "npiType2"> = {
    name: "Test Organization",
    organizationId,
    npiType2: makeNPI(),
  };
  if (!org.npiType2) throw new Error("Organization is missing NPI Type 2");
  const commonWell = new CommonWell({
    orgCert: orgCertificateString,
    rsaPrivateKey: orgPrivateKeyString,
    orgName: org.name,
    oid: org.organizationId,
    homeCommunityId: org.organizationId,
    npi: org.npiType2,
    apiMode: APIMode.integration,
  });
  await initContributionHttpServer(commonWell);
}

main();

import { Organization } from "@metriport/core/domain/organization";
import { toFHIR } from "@metriport/core/external/fhir/organization/conversion";
import { BadRequestError } from "@metriport/shared";
import { createTenantIfNotExists } from "../../../external/fhir/admin";
import { upsertOrgToFHIRServer } from "../../../external/fhir/organization/upsert-organization";
import { getOrganization } from "./get-organization";

export async function syncOrganizationToFhir({ cxId }: { cxId: string }): Promise<Organization> {
  const existingOrg = await getOrganization({ cxId });
  if (!existingOrg) throw new BadRequestError(`Organization does not exist for customer ${cxId}`);

  const org = existingOrg.dataValues;
  await createTenantIfNotExists(org);
  const fhirOrg = toFHIR(org);
  await upsertOrgToFHIRServer(org.cxId, fhirOrg);

  return org;
}

import { Organization } from "@medplum/fhirtypes";
import { makeFhirApi } from "../api/api-factory";

export const upsertOrgToFHIRServer = async (cxId: string, organization: Organization) => {
  await makeFhirApi(cxId).updateResource(organization);
};

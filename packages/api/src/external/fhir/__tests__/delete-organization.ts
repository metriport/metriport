import { makeFhirApi } from "../api/api-factory";
import { ResourceType } from "../shared";

/**
 * For E2E testing locally and staging
 */
export const deleteOrgFromFHIRServer = async (cxId: string, id: string) => {
  await makeFhirApi(cxId).deleteResource(ResourceType.Organization, id);
};

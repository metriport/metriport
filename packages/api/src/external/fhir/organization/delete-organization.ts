import { makeFhirApi } from "../api/api-factory";
import { ResourceType } from "../shared";

export const deleteOrgFromFHIRServer = async (cxId: string, id: string) => {
  await makeFhirApi(cxId).deleteResource(ResourceType.Organization, id);
};

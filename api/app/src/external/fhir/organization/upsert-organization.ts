import { Organization } from "@medplum/fhirtypes";
import { Config } from "../../../shared/config";
import { makeFhirApi } from "../api/api-factory";

export const upsertOrgToFHIRServer = async (cxId: string, organization: Organization) => {
  if (Config.isSandbox()) {
    return;
  }

  await makeFhirApi(cxId).updateResource(organization);
};

import { Organization } from "@medplum/fhirtypes";
import { api } from "../api";
import { Config } from "../../../shared/config";

export const upsertOrgToFHIRServer = async (organization: Organization) => {
  if (Config.isSandbox()) {
    return;
  }

  await api.updateResource(organization);
};

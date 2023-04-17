import { Organization } from "@medplum/fhirtypes";
import { api } from "../api";

export const upsertOrgToFHIRServer = async (organization: Organization) => {
  await api.updateResource(organization);
};

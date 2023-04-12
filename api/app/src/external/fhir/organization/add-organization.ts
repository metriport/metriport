import { Organization } from "@medplum/fhirtypes";
import { api } from "../api";
import { capture } from "../../../shared/notifications";

export const addOrgToFHIRServer = async (organization: Organization) => {
  try {
    return await api.updateResource(organization);
  } catch (err) {
    capture.error(err, {
      extra: { context: `fhir.add.organization` },
    });
  }
};

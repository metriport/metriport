import { Organization } from "@medplum/fhirtypes";
import {
  withNullFlavor,
  buildAddress,
  buildRepresentedOrganization,
  buildTelecom,
} from "../commons";
import { CDAAuthor } from "../types";
import { rootAttribute, valueAttribute } from "../constants";

export function buildAuthor(organization: Organization): CDAAuthor {
  const author = {
    time: withNullFlavor(undefined, valueAttribute),
    assignedAuthor: {
      id: withNullFlavor(organization.id, rootAttribute),
      addr: buildAddress(organization.address),
      telecom: buildTelecom(organization.telecom),
      representedOrganization: buildRepresentedOrganization(organization),
    },
  };
  return author;
}

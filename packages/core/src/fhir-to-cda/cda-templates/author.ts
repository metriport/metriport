import { Organization } from "@medplum/fhirtypes";
import {
  buildAddress,
  buildRepresentedOrganization,
  buildTelecom,
  withNullFlavor,
  withNullFlavorObject,
} from "./commons";
import { CDAAuthor } from "./types";

export function buildAuthor(organization: Organization): CDAAuthor {
  const author = {
    time: withNullFlavor(undefined),
    assignedAuthor: {
      id: withNullFlavorObject(organization.id, "@_root"),
      addr: buildAddress(organization.address),
      telecom: buildTelecom(organization.telecom),
      representedOrganization: buildRepresentedOrganization(organization),
    },
  };
  return author;
}

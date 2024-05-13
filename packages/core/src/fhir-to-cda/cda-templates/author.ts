import { Organization } from "@medplum/fhirtypes";
import {
  buildAddress,
  buildRepresentedOrganization,
  buildTelecom,
  withNullFlavor,
} from "./commons";
import { CdaAuthor } from "../cda-types/shared-types";
import { rootAttribute, valueAttribute } from "./constants";

export function buildAuthor(organization: Organization): CdaAuthor {
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

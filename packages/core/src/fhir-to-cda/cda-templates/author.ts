import { Organization } from "@medplum/fhirtypes";
import {
  buildAddress,
  buildRepresentedOrganization,
  buildTelecom,
  withNullFlavor,
} from "./commons";
import { CDAAuthor } from "../cda-types/shared-types";
import { _rootAttribute, _valueAttribute } from "./constants";

export function buildAuthor(organization: Organization): CDAAuthor {
  const author = {
    time: withNullFlavor(undefined, _valueAttribute),
    assignedAuthor: {
      id: withNullFlavor(organization.id, _rootAttribute),
      addr: buildAddress(organization.address),
      telecom: buildTelecom(organization.telecom),
      representedOrganization: buildRepresentedOrganization(organization),
    },
  };
  return author;
}

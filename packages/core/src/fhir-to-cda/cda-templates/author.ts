import { Organization } from "@medplum/fhirtypes";
import { CdaAuthor } from "../cda-types/shared-types";
import {
  buildAddress,
  buildRepresentedOrganization,
  buildTelecom,
  withNullFlavor,
} from "./commons";
import { _rootAttribute, _valueAttribute } from "./constants";

export function buildAuthor(organization: Organization): CdaAuthor {
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

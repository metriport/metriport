import { Organization } from "@medplum/fhirtypes";
import {
  withNullFlavor,
  buildAddress,
  buildRepresentedOrganization,
  buildTelecom,
} from "../commons";
import { CdaAuthor } from "../../cda-types/shared-types";
import { _rootAttribute, _valueAttribute } from "../constants";

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

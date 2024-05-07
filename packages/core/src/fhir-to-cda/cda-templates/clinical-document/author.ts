import { Organization } from "@medplum/fhirtypes";
import { CDAAuthor } from "../../cda-types/shared-types";
import {
  buildAddress,
  buildRepresentedOrganization,
  buildTelecom,
  formatDateToCDATimestamp,
  withNullFlavor,
} from "../commons";
import { rootAttribute, valueAttribute } from "../constants";

export function buildAuthor(organization: Organization): CDAAuthor {
  const author = {
    time: withNullFlavor(formatDateToCDATimestamp(new Date().toISOString()), valueAttribute),
    assignedAuthor: {
      id: withNullFlavor(organization.id, rootAttribute),
      addr: buildAddress(organization.address),
      telecom: buildTelecom(organization.telecom),
      representedOrganization: buildRepresentedOrganization(organization),
    },
  };
  return author;
}

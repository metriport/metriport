import { Organization } from "@medplum/fhirtypes";
import {
  buildAddress,
  buildRepresentedOrganization,
  buildTelecom,
  formatDateToCDATimeStamp,
  withNullFlavor,
} from "../commons";
import { rootAttribute, valueAttribute } from "../constants";
import { CDAAuthor } from "../types";

export function buildAuthor(organization: Organization): CDAAuthor {
  const author = {
    time: withNullFlavor(formatDateToCDATimeStamp(new Date().toISOString()), valueAttribute),
    assignedAuthor: {
      id: withNullFlavor(organization.id, rootAttribute),
      addr: buildAddress(organization.address),
      telecom: buildTelecom(organization.telecom),
      representedOrganization: buildRepresentedOrganization(organization),
    },
  };
  return author;
}

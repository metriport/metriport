import { Organization } from "@medplum/fhirtypes";
import { CdaAuthor } from "../../cda-types/shared-types";
import {
  buildAddress,
  buildRepresentedOrganization,
  buildTelecom,
  formatDateToCdaTimestamp,
  withNullFlavor,
} from "../commons";

export function buildAuthor(organization: Organization): CdaAuthor {
  const author = {
    time: withNullFlavor(formatDateToCdaTimestamp(new Date().toISOString()), "_value"),
    assignedAuthor: {
      id: withNullFlavor(organization.id, "_root"),
      addr: buildAddress(organization.address),
      telecom: buildTelecom(organization.telecom),
      representedOrganization: buildRepresentedOrganization(organization),
    },
  };
  return author;
}

import { Organization } from "@medplum/fhirtypes";
import { CdaAuthor } from "../../cda-types/shared-types";
import {
  buildAddress,
  buildRepresentedOrganization,
  buildTelecom,
  formatDateToCdaTimestamp,
  withNullFlavor,
} from "../commons";
import { clinicalDocumentConstants } from "../constants";

export function buildAuthor(organization: Organization, date?: string | undefined): CdaAuthor {
  const author = {
    time: date
      ? withNullFlavor(formatDateToCdaTimestamp(date), "_value")
      : withNullFlavor(formatDateToCdaTimestamp(new Date().toISOString()), "_value"),
    assignedAuthor: {
      id: withNullFlavor(organization.id, "_root"),
      addr: buildAddress(organization.address),
      telecom: buildTelecom(organization.telecom),
      assignedAuthoringDevice: {
        manufacturerModelName: {
          "#text": clinicalDocumentConstants.assigningAuthorityName,
        },
        softwareName: {
          "#text": clinicalDocumentConstants.assigningAuthorityName,
        },
      },
      representedOrganization: buildRepresentedOrganization(organization),
    },
  };
  return author;
}

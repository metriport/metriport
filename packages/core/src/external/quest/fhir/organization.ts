import _ from "lodash";
import { uuidv7 } from "@metriport/shared/util/uuid-v7";
import { Address, ContactPoint, Organization, Reference } from "@medplum/fhirtypes";
import { ResponseDetail } from "../schema/response";
import { getQuestDataSourceExtension } from "./shared";

/**
 * The organization that ordered the lab tests.
 */
export function getOrganization(detail: ResponseDetail): Organization {
  const name = getOrganizationName(detail);
  const address = getOrganizationAddress(detail);
  const telecom = getOrganizationTelecom(detail);
  const extension = [getQuestDataSourceExtension()];

  return {
    resourceType: "Organization",
    id: uuidv7(),
    ...(name ? { name } : {}),
    ...(address ? { address } : {}),
    ...(telecom ? { telecom } : {}),
    extension,
  };
}

export function getOrganizationReference(organization: Organization): Reference<Organization> {
  return {
    reference: `Organization/${organization.id}`,
  };
}

function getOrganizationName(detail: ResponseDetail): string | undefined {
  if (!detail.orderingAccountName) return undefined;
  return detail.orderingAccountName;
}

function getOrganizationAddress(detail: ResponseDetail): Address[] | undefined {
  if (
    !detail.orderingAccountAddressLine1 ||
    !detail.orderingAccountCity ||
    !detail.orderingAccountState ||
    !detail.orderingAccountZipCode
  )
    return undefined;

  return [
    {
      city: detail.orderingAccountCity,
      state: detail.orderingAccountState,
      postalCode: detail.orderingAccountZipCode,
      line: _([detail.orderingAccountAddressLine1, detail.orderingAccountAddressLine2])
        .compact()
        .value(),
    },
  ];
}

function getOrganizationTelecom(detail: ResponseDetail): ContactPoint[] | undefined {
  if (!detail.orderingAccountPhoneNumber) return undefined;

  return [
    {
      system: "phone",
      value: detail.orderingAccountPhoneNumber,
    },
  ];
}

import { Address, ContactPoint, Identifier, Organization } from "@medplum/fhirtypes";
import { ResponseDetail } from "../schema/response";

/**
 * The organization that ordered the tests.
 * @returns {Organization} FHIR resource
 */
export function getOrganization(detail: ResponseDetail): Organization {
  const identifier = getOrganizationIdentifier(detail);
  const name = getOrganizationName(detail);
  const address = getOrganizationAddress(detail);
  const telecom = getOrganizationTelecom(detail);

  return {
    resourceType: "Organization",
    identifier,
    ...(name ? { name } : {}),
    ...(address ? { address } : {}),
    ...(telecom ? { telecom } : {}),
  };
}

function getOrganizationIdentifier(detail: ResponseDetail): Identifier[] {
  return [
    {
      system: "http://hl7.org/fhir/sid/us-npi",
      value: detail.orderingAccountNumber,
    },
  ];
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
      line: [detail.orderingAccountAddressLine1, detail.orderingAccountAddressLine2].filter(
        Boolean
      ) as string[],
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

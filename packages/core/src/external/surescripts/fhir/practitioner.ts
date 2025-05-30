import { Practitioner } from "@medplum/fhirtypes";
import { FlatFileDetail } from "../schema/response";

export function parsePractitioner(detail: FlatFileDetail): Practitioner {
  const practitionerName = parsePractitionerName(detail);
  const practitionerAddress = parsePractitionerAddress(detail);

  return {
    resourceType: "Practitioner",
    identifier: [
      {
        system: "http://hl7.org/fhir/sid/us-npi",
        value: detail.prescriberNPI,
      },
    ],
    ...(practitionerName && practitionerName.length > 0 ? { name: practitionerName } : null),
    ...(practitionerAddress && practitionerAddress.length > 0
      ? { address: practitionerAddress }
      : null),
  };
}

function parsePractitionerName(detail: FlatFileDetail): Practitioner["name"] {
  if (!detail.prescriberFirstName || !detail.prescriberLastName) return [];

  const givenNames = [detail.prescriberFirstName];
  if (detail.prescriberMiddleName) givenNames.push(...detail.prescriberMiddleName.split(" "));

  return [
    {
      given: givenNames,
      family: detail.prescriberLastName,
      ...(detail.prescriberPrefix ? { prefix: [detail.prescriberPrefix] } : null),
      ...(detail.prescriberSuffix ? { suffix: [detail.prescriberSuffix] } : null),
    },
  ];
}

function parsePractitionerAddress(detail: FlatFileDetail): Practitioner["address"] {
  if (
    !detail.prescriberAddressLine1 ||
    !detail.prescriberCity ||
    !detail.prescriberState ||
    !detail.prescriberZipCode
  )
    return undefined;

  return [
    {
      line: [detail.prescriberAddressLine1, detail.prescriberAddressLine2].filter(
        (line): line is string => Boolean(line)
      ),
      city: detail.prescriberCity,
      state: detail.prescriberState,
      postalCode: detail.prescriberZipCode,
    },
  ];
}

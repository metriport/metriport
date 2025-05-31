import { Identifier, Practitioner } from "@medplum/fhirtypes";
import { FlatFileDetail } from "../schema/response";

export function getPrescriber(detail: FlatFileDetail): Practitioner {
  const prescriberName = getPrescriberName(detail);
  const prescriberAddress = getPrescriberAddress(detail);

  const identifiers = getPrescriberIdentifiers(detail);
  const telecom = getPrescriberTelecom(detail);

  return {
    resourceType: "Practitioner",
    ...(identifiers.length > 0 ? { identifier: identifiers } : null),
    ...(prescriberName && prescriberName.length > 0 ? { name: prescriberName } : null),
    ...(prescriberAddress && prescriberAddress.length > 0 ? { address: prescriberAddress } : null),
    ...(telecom && telecom.length > 0 ? { telecom } : null),
  };
}

function getPrescriberIdentifiers(detail: FlatFileDetail): Identifier[] {
  const identifiers: Identifier[] = [];
  if (detail.prescriberNPI) {
    identifiers.push({
      system: "http://hl7.org/fhir/sid/us-npi",
      value: detail.prescriberNPI,
    });
  }
  if (detail.prescriberDeaNumber) {
    identifiers.push({
      system: "http://hl7.org/fhir/sid/us-dea",
      value: detail.prescriberDeaNumber,
    });
  }
  if (detail.prescriberStateLicenseNumber && detail.prescriberState) {
    identifiers.push({
      system: `https://public.metriport.com/fhir/sid/us-license-${detail.prescriberState}`,
      value: detail.prescriberStateLicenseNumber,
    });
  }
  return identifiers;
}

function getPrescriberName(detail: FlatFileDetail): Practitioner["name"] {
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

function getPrescriberAddress(detail: FlatFileDetail): Practitioner["address"] {
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

function getPrescriberTelecom(detail: FlatFileDetail): Practitioner["telecom"] {
  const telecom: Practitioner["telecom"] = [];
  if (detail.prescriberPhoneNumber) {
    telecom.push({
      system: "phone",
      value: detail.prescriberPhoneNumber,
    });
  }
  if (detail.prescriberFaxNumber) {
    telecom.push({
      system: "fax",
      value: detail.prescriberFaxNumber,
    });
  }
  return telecom;
}

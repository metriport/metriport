import { Identifier, Practitioner } from "@medplum/fhirtypes";
import { uuidv7 } from "@metriport/shared/util/uuid-v7";
import { ResponseDetail } from "../schema/response";

export function getPrescriber(detail: ResponseDetail): Practitioner {
  const prescriberName = getPrescriberName(detail);
  const prescriberAddress = getPrescriberAddress(detail);
  const identifiers = getPrescriberIdentifiers(detail);
  const telecom = getPrescriberTelecom(detail);

  // detail.prescriberSuffix

  return {
    resourceType: "Practitioner",
    id: uuidv7(),
    ...(identifiers.length > 0 ? { identifier: identifiers } : undefined),
    ...(prescriberName && prescriberName.length > 0 ? { name: prescriberName } : undefined),
    ...(prescriberAddress && prescriberAddress.length > 0
      ? { address: prescriberAddress }
      : undefined),
    ...(telecom && telecom.length > 0 ? { telecom } : undefined),
  };
}

function getPrescriberIdentifiers(detail: ResponseDetail): Identifier[] {
  const identifiers: Identifier[] = [];
  if (detail.prescriberNpiNumber) {
    identifiers.push({
      system: "http://hl7.org/fhir/sid/us-npi",
      value: detail.prescriberNpiNumber,
    });
  }
  if (detail.prescriberDeaNumber) {
    identifiers.push({
      system: "http://hl7.org/fhir/sid/us-dea",
      value: detail.prescriberDeaNumber,
      use: "official",
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

function getPrescriberName(detail: ResponseDetail): Practitioner["name"] {
  if (!detail.prescriberFirstName || !detail.prescriberLastName) return [];

  const givenNames = [detail.prescriberFirstName];
  if (detail.prescriberMiddleName) givenNames.push(...detail.prescriberMiddleName.split(" "));

  return [
    {
      given: givenNames,
      family: detail.prescriberLastName,
      ...(detail.prescriberPrefix ? { prefix: [detail.prescriberPrefix] } : undefined),
      ...(detail.prescriberSuffix ? { suffix: [detail.prescriberSuffix] } : undefined),
    },
  ];
}

function getPrescriberAddress(detail: ResponseDetail): Practitioner["address"] {
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
      country: "USA",
      use: "work",
    },
  ];
}

function getPrescriberTelecom(detail: ResponseDetail): Practitioner["telecom"] {
  const telecom: Practitioner["telecom"] = [];
  if (detail.prescriberPhoneNumber) {
    telecom.push({
      system: "phone",
      use: "work",
      value: detail.prescriberPhoneNumber,
    });
  }
  if (detail.prescriberFaxNumber) {
    telecom.push({
      system: "fax",
      use: "work",
      value: detail.prescriberFaxNumber,
    });
  }
  return telecom;
}

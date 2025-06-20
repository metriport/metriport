import { Identifier, Practitioner, Reference } from "@medplum/fhirtypes";
import { uuidv7 } from "@metriport/shared/util/uuid-v7";
import { ResponseDetail } from "../schema/response";
import { DEA_SCHEDULE_URL, NPI_URL } from "./constants";
import { getSurescriptsDataSourceExtension } from "./shared";

export function getPrescriber(detail: ResponseDetail): Practitioner {
  const prescriberName = getPrescriberName(detail);
  const prescriberAddress = getPrescriberAddress(detail);
  const identifiers = getPrescriberIdentifiers(detail);
  const telecom = getPrescriberTelecom(detail);
  const extension = [getSurescriptsDataSourceExtension()];

  return {
    resourceType: "Practitioner",
    id: uuidv7(),
    ...(identifiers.length > 0 ? { identifier: identifiers } : undefined),
    ...(prescriberName && prescriberName.length > 0 ? { name: prescriberName } : undefined),
    ...(prescriberAddress && prescriberAddress.length > 0
      ? { address: prescriberAddress }
      : undefined),
    ...(telecom && telecom.length > 0 ? { telecom } : undefined),
    extension,
  };
}

export function getPrescriberReference(prescriber: Practitioner): Reference<Practitioner> {
  return {
    reference: `Practitioner/${prescriber.id}`,
    id: prescriber.id ?? "",
  };
}

function getPrescriberIdentifiers(detail: ResponseDetail): Identifier[] {
  const identifiers: Identifier[] = [];
  if (detail.prescriberNpiNumber) {
    identifiers.push({
      system: NPI_URL,
      value: detail.prescriberNpiNumber,
    });
  }
  if (detail.prescriberDeaNumber) {
    identifiers.push({
      system: DEA_SCHEDULE_URL,
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
  const fullName = [...givenNames, detail.prescriberLastName].join(" ");

  return [
    {
      text: fullName,
      given: givenNames,
      family: detail.prescriberLastName,
      ...(detail.prescriberPrefix ? { prefix: [detail.prescriberPrefix] } : undefined),
      ...(detail.prescriberSuffix ? { suffix: [detail.prescriberSuffix] } : undefined),
    },
  ];
}

function getPrescriberAddress(detail: ResponseDetail): Practitioner["address"] | undefined {
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

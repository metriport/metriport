import { Organization, Identifier } from "@medplum/fhirtypes";
import { uuidv7 } from "@metriport/shared/util/uuid-v7";
import { ResponseDetail } from "../schema/response";

export function getPharmacy(detail: ResponseDetail): Organization | undefined {
  if (!detail.pharmacyNpiNumber && !detail.ncpdpId) return undefined;

  const name = getPharmacyName(detail);
  const address = getPharmacyAddress(detail);
  const telecom = getPharmacyTelecom(detail);
  const identifiers = getPharmacyIdentifiers(detail);

  return {
    resourceType: "Organization",
    id: uuidv7(),
    name,
    ...(identifiers.length > 0 ? { identifier: identifiers } : undefined),
    ...(address && address.length > 0 ? { address } : undefined),
    ...(telecom && telecom.length > 0 ? { telecom } : undefined),
  };
}

function getPharmacyName(detail: ResponseDetail): string {
  if (detail.pharmacyName) return detail.pharmacyName;
  if (detail.pharmacyNpiNumber) return `NPI: ${detail.pharmacyNpiNumber}`;
  if (detail.ncpdpId) return `NCPDP: ${detail.ncpdpId}`;
  return "Unknown Pharmacy";
}

function getPharmacyIdentifiers(detail: ResponseDetail): Identifier[] {
  const identifiers: Identifier[] = [];
  if (detail.pharmacyNpiNumber) {
    identifiers.push({
      system: "http://hl7.org/fhir/sid/us-npi",
      value: detail.pharmacyNpiNumber,
    });
  }
  if (detail.ncpdpId) {
    identifiers.push({
      system: "http://terminology.hl7.org/CodeSystem/NCPDPProviderIdentificationNumber",
      value: detail.ncpdpId,
    });
  }
  return identifiers;
}

function getPharmacyAddress(detail: ResponseDetail): Organization["address"] {
  if (
    !detail.pharmacyAddressLine1 ||
    !detail.pharmacyCity ||
    !detail.pharmacyState ||
    !detail.pharmacyZipCode
  )
    return undefined;

  return [
    {
      line: [detail.pharmacyAddressLine1, detail.pharmacyAddressLine2].filter(
        (line): line is string => Boolean(line)
      ),
      city: detail.pharmacyCity,
      state: detail.pharmacyState,
      postalCode: detail.pharmacyZipCode,
    },
  ];
}

function getPharmacyTelecom(detail: ResponseDetail): Organization["telecom"] {
  const telecom: Organization["telecom"] = [];
  if (detail.pharmacyPhoneNumber)
    telecom.push({
      system: "phone",
      value: detail.pharmacyPhoneNumber,
    });
  if (detail.pharmacyFaxNumber)
    telecom.push({
      system: "fax",
      value: detail.pharmacyFaxNumber,
    });
  return telecom;
}

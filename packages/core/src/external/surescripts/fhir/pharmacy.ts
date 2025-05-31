import { Organization, Identifier } from "@medplum/fhirtypes";
import { FlatFileDetail } from "../schema/response";

export function getPharmacy(detail: FlatFileDetail): Organization | undefined {
  if (!detail.pharmacyNpiNumber && !detail.ncpdpId) return undefined;

  const name = getPharmacyName(detail);
  const address = getPharmacyAddress(detail);
  const telecom = getPharmacyTelecom(detail);
  const identifiers = getPharmacyIdentifiers(detail);

  return {
    resourceType: "Organization",
    name,
    ...(identifiers.length > 0 ? { identifier: identifiers } : null),
    ...(address && address.length > 0 ? { address } : null),
    ...(telecom && telecom.length > 0 ? { telecom } : null),
  };
}

function getPharmacyName(detail: FlatFileDetail): string {
  if (detail.pharmacyName) return detail.pharmacyName;
  if (detail.pharmacyNpiNumber) return `NPI: ${detail.pharmacyNpiNumber}`;
  if (detail.ncpdpId) return `NCPDP: ${detail.ncpdpId}`;
  return "Unknown Pharmacy";
}

function getPharmacyIdentifiers(detail: FlatFileDetail): Identifier[] {
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

function getPharmacyAddress(detail: FlatFileDetail): Organization["address"] {
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

function getPharmacyTelecom(detail: FlatFileDetail): Organization["telecom"] {
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

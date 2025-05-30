import { Organization } from "@medplum/fhirtypes";
import { FlatFileDetail } from "../schema/response";

export function parsePharmacy(detail: FlatFileDetail): Organization | undefined {
  if (!detail.pharmacyNpiNumber || !detail.pharmacyName) return undefined;

  const address = parsePharmacyAddress(detail);
  const telecom = parsePharmacyTelecom(detail);

  return {
    resourceType: "Organization",
    identifier: [
      {
        system: "http://hl7.org/fhir/sid/us-npi",
        value: detail.pharmacyNpiNumber,
      },
    ],
    name: detail.pharmacyName,
    ...(address && address.length > 0 ? { address } : null),
    ...(telecom && telecom.length > 0 ? { telecom } : null),
  };
}

function parsePharmacyAddress(detail: FlatFileDetail): Organization["address"] {
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

function parsePharmacyTelecom(detail: FlatFileDetail): Organization["telecom"] {
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

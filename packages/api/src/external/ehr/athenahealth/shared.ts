import { PatientResource } from "@metriport/shared/interface/external/athenahealth/patient";
import {
  normalizeEmail,
  normalizePhoneNumber,
  normalizeState,
  normalizeZipCode,
} from "@metriport/shared";
import { Contact } from "@metriport/core/domain/contact";
import { Address } from "@metriport/core/domain/address";

export function createMetriportContacts(patient: PatientResource): Contact[] {
  return patient.telecom.flatMap(telecom => {
    if (telecom.system === "email") {
      return {
        email: normalizeEmail(telecom.value),
      };
    } else if (telecom.system === "phone") {
      return {
        phone: normalizePhoneNumber(telecom.value),
      };
    }
    return [];
  });
}

export function createMetriportAddresses(patient: PatientResource): Address[] {
  return patient.address.map(address => {
    if (address.line.length === 0) {
      throw new Error("AthenaHealth patient missing at lesat one line in address");
    }
    return {
      addressLine1: address.line[0] as string,
      addressLine2: address.line.length > 1 ? address.line.slice(1).join(" ") : undefined,
      city: address.city,
      state: normalizeState(address.state),
      zip: normalizeZipCode(address.postalCode),
      country: address.country,
    };
  });
}
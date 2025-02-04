import { Address } from "@metriport/core/domain/address";
import { Contact } from "@metriport/core/domain/contact";
import { PatientDemoData } from "@metriport/core/domain/patient";
import {
  BadRequestError,
  MetriportError,
  normalizeDate,
  normalizeEmailNewSafe,
  normalizeGender,
  normalizePhoneNumberSafe,
  normalizeUSStateForAddressSafe,
  normalizeZipCodeNewSafe,
  toTitleCase,
} from "@metriport/shared";
import { PatientWithValidHomeAddress } from "@metriport/shared/interface/external/shared/ehr/patient";

export function createContactsFromFhir(patient: PatientWithValidHomeAddress): Contact[] {
  return (patient.telecom ?? []).flatMap(telecom => {
    if (telecom.system === "email") {
      const email = normalizeEmailNewSafe(telecom.value);
      if (!email) return [];
      return { email };
    } else if (telecom.system === "phone") {
      const phone = normalizePhoneNumberSafe(telecom.value);
      if (!phone) return [];
      return { phone };
    }
    return [];
  });
}

export function createAddressesFromFhir(patient: PatientWithValidHomeAddress): Address[] {
  const addresses = patient.address.flatMap(address => {
    if (!address.line) return [];
    const addressLine1 = (address.line[0] as string).trim();
    if (addressLine1 === "") return [];
    const addressLines2plus = address.line
      .slice(1)
      .map(l => l.trim())
      .filter(l => l !== "");
    const city = address.city.trim();
    if (city === "") return [];
    const country = address.country?.trim();
    if (!country) return [];
    const state = normalizeUSStateForAddressSafe(address.state);
    if (!state) return [];
    const zip = normalizeZipCodeNewSafe(address.postalCode);
    if (!zip) return [];
    return {
      addressLine1,
      addressLine2: addressLines2plus.length === 0 ? undefined : addressLines2plus.join(" "),
      city,
      state,
      zip,
      country,
    };
  });
  if (addresses.length === 0) throw new BadRequestError("Patient has no valid addresses");
  return addresses;
}

export function createNamesFromFhir(
  patient: PatientWithValidHomeAddress
): { firstName: string; lastName: string }[] {
  const names = patient.name.flatMap(name => {
    const lastName = name.family.trim();
    if (lastName === "") return [];
    return name.given.flatMap(gName => {
      const firstName = gName.trim();
      if (firstName === "") return [];
      return [{ firstName: toTitleCase(firstName), lastName: toTitleCase(lastName) }];
    });
  });
  if (names.length === 0) throw new BadRequestError("Patient has no valid names");
  return names;
}

export function createMetriportPatientDemosFhir(
  patient: PatientWithValidHomeAddress
): PatientDemoData[] {
  const dob = normalizeDate(patient.birthDate);
  const genderAtBirth = normalizeGender(patient.gender);
  const addressArray = createAddressesFromFhir(patient);
  const contactArray = createContactsFromFhir(patient);
  const namesArray = createNamesFromFhir(patient);
  return namesArray.map(n => {
    return {
      firstName: n.firstName,
      lastName: n.lastName,
      dob,
      genderAtBirth,
      address: addressArray,
      contact: contactArray,
    };
  });
}

export function collapsePatientDemosFhir(demos: PatientDemoData[]): PatientDemoData {
  const firstDemo = demos[0];
  if (!firstDemo) throw new MetriportError("No patient demos to collapse");
  return demos.reduce((acc: PatientDemoData, demo) => {
    return {
      ...acc,
      firstName: acc.firstName.includes(demo.firstName)
        ? acc.firstName
        : `${acc.firstName} ${demo.firstName}`,
      lastName: acc.lastName.includes(demo.lastName)
        ? acc.lastName
        : `${acc.lastName} ${demo.lastName}`,
    };
  }, firstDemo);
}

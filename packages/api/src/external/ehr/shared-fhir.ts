import { Address } from "@metriport/core/domain/address";
import { Contact } from "@metriport/core/domain/contact";
import { PatientDemoData } from "@metriport/core/domain/patient";
import {
  BadRequestError,
  MetriportError,
  normalizeDob,
  normalizeEmailNewSafe,
  normalizeGender,
  normalizePhoneNumberSafe,
  normalizeUSStateForAddressSafe,
  normalizeZipCodeNewSafe,
  normalizeCountrySafe,
  toTitleCase,
} from "@metriport/shared";
import { Patient } from "@metriport/shared/interface/external/shared/ehr/patient";

export function createContactsFromFhir(patient: Patient): Contact[] {
  return (patient.telecom ?? []).flatMap(telecom => {
    if (telecom.system === "email") {
      if (!telecom.value) return [];
      const email = normalizeEmailNewSafe(telecom.value);
      if (!email) return [];
      return { email };
    } else if (telecom.system === "phone") {
      if (!telecom.value) return [];
      const phone = normalizePhoneNumberSafe(telecom.value);
      if (!phone) return [];
      return { phone };
    }
    return [];
  });
}

export function createAddressesFromFhir(patient: Patient): Address[] {
  if (!patient.address) throw new BadRequestError("Patient has no address");
  const addresses = patient.address.flatMap(address => {
    if (!address.line || address.line.length === 0) return [];
    const addressLine1 = (address.line[0] as string).trim();
    if (addressLine1 === "") return [];
    const addressLines2plus = address.line
      .slice(1)
      .map(l => l.trim())
      .filter(l => l !== "");
    if (!address.city) return [];
    const city = address.city.trim();
    if (city === "") return [];
    if (!address.country) return [];
    const country = normalizeCountrySafe(address.country);
    if (!country) return [];
    if (!address.state) return [];
    const state = normalizeUSStateForAddressSafe(address.state);
    if (!state) return [];
    if (!address.postalCode) return [];
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
  if (addresses.length === 0) {
    throw new BadRequestError("Patient has no valid addresses", undefined, {
      addresses: patient.address.map(a => JSON.stringify(a)).join(","),
    });
  }
  return addresses;
}

export function createNamesFromFhir(patient: Patient): { firstName: string; lastName: string }[] {
  if (!patient.name) throw new BadRequestError("Patient has no name");
  const names = patient.name.flatMap(name => {
    if (!name.family) return [];
    const lastName = name.family.trim();
    if (lastName === "") return [];
    if (!name.given) return [];
    return name.given.flatMap(gName => {
      const firstName = gName.trim();
      if (firstName === "") return [];
      return [{ firstName: toTitleCase(firstName), lastName: toTitleCase(lastName) }];
    });
  });
  if (names.length === 0) {
    throw new BadRequestError("Patient has no valid names", undefined, {
      names: patient.name.map(n => JSON.stringify(n)).join(","),
    });
  }
  return names;
}

export function createMetriportPatientDemosFhir(patient: Patient): PatientDemoData[] {
  const dob = normalizeDob(patient.birthDate);
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
  return demos.slice(1).reduce((acc: PatientDemoData, demo) => {
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

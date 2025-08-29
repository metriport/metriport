import { LinkDemographics } from "@metriport/core/domain/patient-demographics";
import { mapStringMetriportGenderToFhir } from "@metriport/core/external/fhir/patient/conversion";
import { normalizeEmailNewSafe, normalizePhoneNumberSafe } from "@metriport/shared";
import {
  normalizeAddress,
  normalizeAndStringifyNames,
  normalizeDob,
  removeInvalidArrayValues,
  stringifyAddress,
} from "../../../domain/medical/patient-demographics";
import { NetworkLink } from "./types";

export function networkLinkToLinkDemographics(link: NetworkLink): LinkDemographics {
  const patient = link.Patient;
  const dob = normalizeDob(patient.birthDate);
  const gender = mapStringMetriportGenderToFhir(patient.gender ?? undefined);
  const names = patient.name.flatMap(name => {
    return name.family.flatMap(lastName => {
      return (name.given ?? []).map(firstName => {
        return normalizeAndStringifyNames({ firstName, lastName });
      });
    });
  });
  const addresses = patient.address.map(address => {
    return stringifyAddress(
      normalizeAddress({
        line: address.line ?? undefined,
        city: address.city ?? undefined,
        state: address.state ?? undefined,
        zip: address.postalCode ?? undefined,
        country: address.country ?? undefined,
      })
    );
  });
  const telephoneNumbers = (patient.telecom ?? []).flatMap(tc => {
    if (!tc.value || !tc.system) return [];
    if (tc.system !== "phone") return [];
    const phone = normalizePhoneNumberSafe(tc.value);
    if (!phone) return [];
    return [phone];
  });
  const emails = (patient.telecom ?? []).flatMap(tc => {
    if (!tc.value || !tc.system) return [];
    if (tc.system !== "email") return [];
    const email = normalizeEmailNewSafe(tc.value);
    if (!email) return [];
    return [email];
  });
  const driversLicense = patient.identifier.find(id => id.type === "DL")?.value;
  const ssns = patient.identifier.find(id => id.type === "SS")?.value;

  return removeInvalidArrayValues({
    dob,
    gender,
    names,
    addresses,
    telephoneNumbers,
    emails,
    driversLicenses: driversLicense ? [driversLicense] : [],
    ssns: ssns ? [ssns] : [],
  });
}

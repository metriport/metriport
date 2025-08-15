import { normalizePhoneNumberSafe, normalizeEmailNewSafe } from "@metriport/shared";
import { LinkDemographics } from "@metriport/core/domain/patient-demographics";
import { mapStringMetriportGenderToFhir } from "@metriport/core/external/fhir/patient/conversion";
import { PatientNetworkLink } from "@metriport/commonwell-sdk-v1";
import {
  removeInvalidArrayValues,
  normalizeDob,
  normalizeAndStringifyNames,
  normalizeAddress,
  stringifyAddress,
} from "../../domain/medical/patient-demographics";
import { CwLink } from "./cw-patient-data";

export function patientNetworkLinkToNormalizedLinkDemographics(
  patientNetworkLink: PatientNetworkLink
): LinkDemographics {
  const dob = normalizeDob(patientNetworkLink.details.birthDate);
  const gender = mapStringMetriportGenderToFhir(patientNetworkLink.details.gender.code);
  const names = patientNetworkLink.details.name.flatMap(name => {
    return name.family.flatMap(lastName => {
      return (name.given ?? []).map(firstName => {
        return normalizeAndStringifyNames({ firstName, lastName });
      });
    });
  });
  const addresses = patientNetworkLink.details.address.map(address => {
    return stringifyAddress(
      normalizeAddress({
        line: address.line ?? undefined,
        city: address.city ?? undefined,
        state: address.state ?? undefined,
        zip: address.zip ?? undefined,
        country: address.country ?? undefined,
      })
    );
  });
  const telephoneNumbers = (patientNetworkLink.details.telecom ?? []).flatMap(tc => {
    if (!tc.value || !tc.system) return [];
    if (tc.system !== "phone") return [];
    const phone = normalizePhoneNumberSafe(tc.value);
    if (!phone) return [];
    return [phone];
  });
  const emails = (patientNetworkLink.details.telecom ?? []).flatMap(tc => {
    if (!tc.value || !tc.system) return [];
    if (tc.system !== "email") return [];
    const email = normalizeEmailNewSafe(tc.value);
    if (!email) return [];
    return [email];
  });
  /* TODO
  const driversLicenses = (patientNetworkLink.details.identifiers ?? []).flatMap(p => { 
  });
  const ssns = (patientNetworkLink.details.identifiers ?? []).flatMap(p => { 
  });
  */
  return removeInvalidArrayValues({
    dob,
    gender,
    names,
    addresses,
    telephoneNumbers,
    emails,
    driversLicenses: [],
    ssns: [],
  });
}

export function getPatientNetworkLinks(linkResults: CwLink[]): PatientNetworkLink[] {
  return linkResults.flatMap(lr => {
    const patientNetworkLink = lr.patient;
    if (!patientNetworkLink) return [];
    return patientNetworkLink;
  });
}

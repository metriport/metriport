import {
  normalizeDateSafe,
  normalizeGenderSafe,
  normalizeEmailSafe,
  normalizePhoneSafe,
} from "@metriport/shared";
import { LinkDemographics } from "@metriport/core/domain/patient-demographics";
import { PatientNetworkLink } from "@metriport/commonwell-sdk";
import {
  normalizeAndStringifyNames,
  normalizeAndStringfyAddress,
} from "../../domain/medical/patient-demographics";
import { mapMetriportGenderToFhirGender } from "@metriport/core/external/fhir/patient/conversion";
import { CwLink } from "./cw-patient-data";

export function patientNetworkLinkToNormalizedLinkDemographics(
  patientNetworkLink: PatientNetworkLink
): LinkDemographics {
  const dob = normalizeDateSafe(patientNetworkLink.details.birthDate);
  const gender = mapMetriportGenderToFhirGender(
    normalizeGenderSafe(patientNetworkLink.details.gender.code)
  );
  const names = patientNetworkLink.details.name.flatMap(name => {
    return name.family.flatMap(lastName => {
      return (name.given ?? []).flatMap(firstName => {
        const normalizedNames = normalizeAndStringifyNames({ firstName, lastName });
        if (!normalizedNames) return [];
        return [normalizedNames];
      });
    });
  });
  const addresses = patientNetworkLink.details.address.flatMap(address => {
    const normalizedAddress = normalizeAndStringfyAddress({
      line: address.line ?? undefined,
      city: address.city ?? undefined,
      state: address.state ?? undefined,
      zip: address.zip ?? undefined,
      country: address.country ?? undefined,
    });
    if (!normalizedAddress) return [];
    return [normalizedAddress];
  });
  const telephoneNumbers = (patientNetworkLink.details.telecom ?? []).flatMap(tc => {
    if (!tc.value || !tc.system) return [];
    if (tc.system !== "phone") return [];
    const normalizedPhone = normalizePhoneSafe(tc.value);
    if (!normalizedPhone) return [];
    return [normalizedPhone];
  });
  const emails = (patientNetworkLink.details.telecom ?? []).flatMap(tc => {
    if (!tc.value || !tc.system) return [];
    if (tc.system !== "email") return [];
    const normalizedEmail = normalizeEmailSafe(tc.value);
    if (!normalizedEmail) return [];
    return [normalizedEmail];
  });
  /* TODO
  const driversLicenses = (patientNetworkLink.details.identifiers ?? []).flatMap(p => {
  });
  const ssns = (patientNetworkLink.details.identifiers ?? []).flatMap(p => {
  });
  */
  return {
    dob,
    gender,
    names,
    addresses,
    telephoneNumbers,
    emails,
    driversLicenses: [],
    ssns: [],
  };
}

export function getPatientNetworkLinks(linkResults: CwLink[]): PatientNetworkLink[] {
  return linkResults.flatMap(lr => {
    const patientNetworkLink = lr.patient;
    if (!patientNetworkLink) return [];
    return patientNetworkLink;
  });
}

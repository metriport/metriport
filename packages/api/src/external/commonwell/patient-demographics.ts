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
        const name = normalizeAndStringifyNames({ firstName, lastName });
        if (!name) return [];
        return [name];
      });
    });
  });
  const addresses = patientNetworkLink.details.address.flatMap(a => {
    const address = normalizeAndStringfyAddress({
      line: a.line ?? undefined,
      city: a.city ?? undefined,
      state: a.state ?? undefined,
      zip: a.zip ?? undefined,
      country: a.country ?? undefined,
    });
    if (!address) return [];
    return [address];
  });
  const telephoneNumbers = (patientNetworkLink.details.telecom ?? []).flatMap(tc => {
    if (!tc.value || !tc.system) return [];
    if (tc.system !== "phone") return [];
    const phone = normalizePhoneSafe(tc.value);
    if (!phone) return [];
    return [phone];
  });
  const emails = (patientNetworkLink.details.telecom ?? []).flatMap(tc => {
    if (!tc.value || !tc.system) return [];
    if (tc.system !== "email") return [];
    const email = normalizeEmailSafe(tc.value);
    if (!email) return [];
    return [email];
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

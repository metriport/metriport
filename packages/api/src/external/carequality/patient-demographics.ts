import {
  normalizeDateSafe,
  normalizeGenderSafe,
  normalizeEmailSafe,
  normalizePhoneSafe,
  normalizeSsnSafe,
} from "@metriport/shared";
import { LinkDemographics } from "@metriport/core/domain/patient-demographics";
import { PatientResource } from "@metriport/ihe-gateway-sdk";
import {
  normalizeAndStringifyNames,
  normalizeAndStringfyAddress,
} from "../../domain/medical/patient-demographics";
import { ssnSystemCode } from "@metriport/core/domain/oid";
import { mapMetriportGenderToFhirGender } from "@metriport/core/external/fhir/patient/conversion";
import { CQLink } from "./cq-patient-data";

export function patientResourceToNormalizedLinkDemographics(
  patientResource: PatientResource
): LinkDemographics {
  const dob = normalizeDateSafe(patientResource.birthDate);
  const gender = mapMetriportGenderToFhirGender(normalizeGenderSafe(patientResource.gender));
  const names = patientResource.name.flatMap(name => {
    const lastName = name.family;
    return name.given.flatMap(firstName => {
      const name = normalizeAndStringifyNames({ firstName, lastName });
      if (!name) return [];
      return [name];
    });
  });
  const addresses = (patientResource.address ?? []).flatMap(a => {
    const address = normalizeAndStringfyAddress({
      line: a.line,
      city: a.city,
      state: a.state,
      zip: a.postalCode,
      country: a.country,
    });
    if (!address) return [];
    return [address];
  });
  const telephoneNumbers = (patientResource.telecom ?? []).flatMap(tc => {
    if (!tc.value) return [];
    if (tc.system !== "phone" && tc.value.includes("@")) return [];
    const phone = normalizePhoneSafe(tc.value);
    if (!phone) return [];
    return [phone];
  });
  const emails = (patientResource.telecom ?? []).flatMap(tc => {
    if (!tc.value) return [];
    if (tc.system !== "email" && !tc.value.includes("@")) return [];
    const email = normalizeEmailSafe(tc.value);
    if (!email) return [];
    return [email];
  });
  /* TODO
  const driversLicenses = (patientResource.identifiers ?? []).flatMap(p => {
  });
  */
  const ssns = (patientResource.identifier ?? []).flatMap(id => {
    if (!id.value) return [];
    if (id.system !== ssnSystemCode) return [];
    const ssn = normalizeSsnSafe(id.value);
    if (!ssn) return [];
    return [ssn];
  });
  return {
    dob,
    gender,
    names,
    addresses,
    telephoneNumbers,
    emails,
    driversLicenses: [],
    ssns,
  };
}

export function getPatientResources(linkResults: CQLink[]): PatientResource[] {
  return linkResults.flatMap(lr => {
    const patientResource = lr.patientResource;
    if (!patientResource) return [];
    return patientResource;
  });
}

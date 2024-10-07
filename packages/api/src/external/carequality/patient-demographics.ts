import {
  normalizeDateSafe,
  normalizeGenderSafe,
  normalizeEmailSafe,
  normalizePhoneNumber,
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
      const normalizedNames = normalizeAndStringifyNames({ firstName, lastName });
      if (!normalizedNames) return [];
      return [normalizedNames];
    });
  });
  const addresses = (patientResource.address ?? []).flatMap(a => {
    const normalizedAddress = normalizeAndStringfyAddress({
      line: a.line,
      city: a.city,
      state: a.state,
      zip: a.postalCode,
      country: a.country,
    });
    if (!normalizedAddress) return [];
    return [normalizedAddress];
  });
  const telephoneNumbers = (patientResource.telecom ?? []).flatMap(tc => {
    if (!tc.value) return [];
    if (tc.system !== "phone" && tc.value.includes("@")) return [];
    return [normalizePhoneNumber(tc.value)];
  });
  const emails = (patientResource.telecom ?? []).flatMap(tc => {
    if (!tc.value) return [];
    if (tc.system !== "email" && !tc.value.includes("@")) return [];
    const normalizedEmail = normalizeEmailSafe(tc.value);
    if (!normalizedEmail) return [];
    return [normalizedEmail];
  });
  /* TODO
  const driversLicenses = (patientResource.identifiers ?? []).flatMap(p => {
  });
  */
  const ssns = (patientResource.identifier ?? []).flatMap(id => {
    if (!id.value) return [];
    if (id.system !== ssnSystemCode) return [];
    const normalizedSsn = normalizeSsnSafe(id.value);
    if (!normalizedSsn) return [];
    return [normalizedSsn];
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

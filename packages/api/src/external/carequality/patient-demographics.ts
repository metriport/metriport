import { LinkDemographics } from "@metriport/core/domain/patient-demographics";
import { PatientResource } from "@metriport/ihe-gateway-sdk";
import {
  removeInvalidArrayValues,
  normalizeDob,
  normalizeAndStringifyNames,
  normalizeAddress,
  stringifyAddress,
  normalizeTelephone,
  normalizeEmail,
} from "../../domain/medical/patient-demographics";
import { CQLink } from "./cq-patient-data";

export function patientResourceToNormalizedLinkDemographics(
  patientResource: PatientResource
): LinkDemographics {
  const dob = normalizeDob(patientResource.birthDate);
  const gender = patientResource.gender;
  const names = patientResource.name.flatMap(name => {
    return name.given.map(firstName => {
      return normalizeAndStringifyNames({ firstName, lastName: name.family });
    });
  });
  const addresses = (patientResource.address ?? []).map(a => {
    return stringifyAddress(
      normalizeAddress({
        line: a.line,
        city: a.city,
        state: a.state,
        zip: a.postalCode,
        country: a.country,
      })
    );
  });
  const telephoneNumbers = (patientResource.telecom ?? []).flatMap(tc => {
    if (!tc.value) return [];
    if (tc.system === "phone" || !tc.value.includes("@")) return [normalizeTelephone(tc.value)];
    return [];
  });
  const emails = (patientResource.telecom ?? []).flatMap(tc => {
    if (!tc.value) return [];
    if (tc.system === "email" || tc.value.includes("@")) {
      const email = normalizeEmail(tc.value);
      if (!email) return [];
      return [email];
    }
    return [];
  });
  /* TODO
  const driversLicenses = (patientResource.personalIdentifiers ?? []).flatMap(p => {
  });
  const ssns = (ppatientResource.personalIdentifiers ?? []).flatMap(p => {
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

export function getPatientResources(linkResults: CQLink[]): PatientResource[] {
  return linkResults.flatMap(lr => {
    const patientResource = lr.patientResource;
    if (!patientResource) return [];
    return patientResource;
  });
}

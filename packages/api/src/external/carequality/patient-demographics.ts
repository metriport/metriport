import { Patient } from "@metriport/core/domain/patient";
import { LinkDemographics } from "@metriport/core/domain/patient-demographics";
import { PatientResource } from "@metriport/ihe-gateway-sdk";
import {
  scoreLink,
  linkHasNewDemographics,
  patientToNormalizedCoreDemographics,
  removeInvalidArrayValues,
  normalizeDob,
  normalizeGender,
  normalizeAndStringifyNames,
  normalizeAddress,
  stringifyAddress,
  normalizeTelephone,
  normalizeEmail,
} from "../../domain/medical/patient-demographics";
import { CQLink } from "./cq-patient-data";

export function getNewDemographics(patient: Patient, links: CQLink[]): LinkDemographics[] {
  const coreDemographics = patientToNormalizedCoreDemographics(patient);
  const consolidatedLinkDemographics = patient.data.consolidatedLinkDemographics;
  return getPatientResources(links)
    .map(patientResourceToNormalizedLinkDemographics)
    .filter(linkDemographics => scoreLink({ coreDemographics, linkDemographics })[0])
    .filter(
      linkDemographics =>
        linkHasNewDemographics({
          coreDemographics,
          consolidatedLinkDemographics,
          linkDemographics,
        })[0]
    );
}

export function patientResourceToNormalizedLinkDemographics(
  patientResource: PatientResource
): LinkDemographics {
  const dob = normalizeDob(patientResource.birthDate);
  const gender = normalizeGender(patientResource.gender);
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
    if (!tc.value || !tc.system) return [];
    if (tc.system !== "phone") return [];
    return [normalizeTelephone(tc.value)];
  });
  const emails = (patientResource.telecom ?? []).flatMap(tc => {
    if (!tc.value || !tc.system) return [];
    if (tc.system !== "email") return [];
    return [normalizeEmail(tc.value)];
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

function getPatientResources(linkResults: CQLink[]): PatientResource[] {
  return linkResults.flatMap(lr => {
    const patientResource = lr.patientResource;
    if (!patientResource) return [];
    return patientResource;
  });
}

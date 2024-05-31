import { Patient } from "@metriport/core/domain/patient";
import { LinkDemographics } from "@metriport/core/domain/patient-demographics";
import { PatientResource } from "@metriport/ihe-gateway-sdk";
import {
  scoreLinkEpic,
  linkHasNewDemographiscData,
  patientCoreDemographicsToNormalizedAndStringifiedLinkDemographics,
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
  const coreDemographics =
    patientCoreDemographicsToNormalizedAndStringifiedLinkDemographics(patient);
  const consolidatedLinkDemograhpics = patient.data.consolidatedLinkDemograhpics;
  return getPatientResources(links)
    .map(patientResourceToNormalizedAndStringifiedLinkDemographics)
    .filter(ld => scoreLinkEpic(coreDemographics, ld))
    .filter(ld => linkHasNewDemographiscData(coreDemographics, consolidatedLinkDemograhpics, ld));
}

function patientResourceToNormalizedAndStringifiedLinkDemographics(
  patientResource: PatientResource
): LinkDemographics {
  const dob = normalizeDob(patientResource.birthDate);
  const gender = normalizeGender(patientResource.gender);
  const names = (patientResource.name ?? []).flatMap(name => {
    return (name.given ?? []).map(firstName => {
      return normalizeAndStringifyNames({ firstName, lastName: name.family });
    });
  });
  const addressesObj = (patientResource.address ?? []).map(a => {
    return normalizeAddress({
      line: a.line,
      city: a.city,
      state: a.state,
      zip: a.postalCode,
      country: a.country,
    });
  });
  const addressesString = addressesObj.map(stringifyAddress);
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
  return {
    dob,
    gender,
    names,
    telephoneNumbers,
    emails,
    addressesObj,
    addressesString,
    driversLicenses: [],
    ssns: [],
  };
}

function getPatientResources(linkResults: CQLink[]): PatientResource[] {
  return linkResults.flatMap(lr => {
    const patientResource = lr.patientResource;
    if (!patientResource) return [];
    return patientResource;
  });
}

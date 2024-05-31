import { Patient } from "@metriport/core/domain/patient";
import { LinkDemographics, LinkGender } from "@metriport/core/domain/patient-demographics";
import { PatientNetworkLink, GenderCodes } from "@metriport/commonwell-sdk";
import { mapGenderAtBirthToFhir } from "@metriport/core/external/fhir/patient/index";
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
import { CwLink } from "./cw-patient-data";

type CwGenderCode = `${GenderCodes}`;

export function getNewDemographics(patient: Patient, links: CwLink[]): LinkDemographics[] {
  const coreDemographics =
    patientCoreDemographicsToNormalizedAndStringifiedLinkDemographics(patient);
  const consolidatedLinkDemograhpics = patient.data.consolidatedLinkDemograhpics;
  return getPatientNetworkLinks(links)
    .map(patientNetworkLinkToNormalizedAndStringifiedLinkDemographics)
    .filter(ld => scoreLinkEpic(coreDemographics, ld))
    .filter(ld => linkHasNewDemographiscData(coreDemographics, consolidatedLinkDemograhpics, ld));
}

function patientNetworkLinkToNormalizedAndStringifiedLinkDemographics(
  patientNetworkLink: PatientNetworkLink
): LinkDemographics {
  const dob = normalizeDob(patientNetworkLink.details.birthDate);
  const cwGender = patientNetworkLink.details.gender.code as CwGenderCode;
  let gender: LinkGender = "unknown";
  if (cwGender === "M" || cwGender === "F") {
    gender = normalizeGender(mapGenderAtBirthToFhir(cwGender));
  }
  const names = (patientNetworkLink.details.name ?? []).flatMap(name => {
    return name.family.flatMap(lastName => {
      return (name.given ?? []).map(firstName => {
        return normalizeAndStringifyNames({ firstName, lastName });
      });
    });
  });
  const addressesObj = patientNetworkLink.details.address.map(address => {
    return normalizeAddress({
      line: address.line ?? undefined,
      city: address.city ?? undefined,
      state: address.state ?? undefined,
      zip: address.zip ?? undefined,
      country: address.country ?? undefined,
    });
  });
  const addressesString = addressesObj.map(stringifyAddress);
  const telephoneNumbers = (patientNetworkLink.details.telecom ?? []).flatMap(tc => {
    if (!tc.value || !tc.system) return [];
    if (tc.system !== "phone") return [];
    return [normalizeTelephone(tc.value)];
  });
  const emails = (patientNetworkLink.details.telecom ?? []).flatMap(tc => {
    if (!tc.value || !tc.system) return [];
    if (tc.system !== "email") return [];
    return [normalizeEmail(tc.value)];
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
    telephoneNumbers,
    emails,
    addressesObj,
    addressesString,
    driversLicenses: [],
    ssns: [],
  };
}

function getPatientNetworkLinks(linkResults: CwLink[]): PatientNetworkLink[] {
  return linkResults.flatMap(lr => {
    const patientNetworkLink = lr.patient;
    if (!patientNetworkLink) return [];
    return patientNetworkLink;
  });
}

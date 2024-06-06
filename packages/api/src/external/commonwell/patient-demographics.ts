import { Patient } from "@metriport/core/domain/patient";
import { LinkDemographics } from "@metriport/core/domain/patient-demographics";
import { PatientNetworkLink } from "@metriport/commonwell-sdk";
import {
  checkDemoMatch,
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
import { CwLink } from "./cw-patient-data";

export function getNewDemographics(patient: Patient, links: CwLink[]): LinkDemographics[] {
  const coreDemographics = patientToNormalizedCoreDemographics(patient);
  const consolidatedLinkDemographics = patient.data.consolidatedLinkDemographics;
  return getPatientNetworkLinks(links)
    .map(patientNetworkLinkToNormalizedLinkDemographics)
    .filter(linkDemographics => checkDemoMatch({ coreDemographics, linkDemographics }).isMatched)
    .filter(
      linkDemographics =>
        linkHasNewDemographics({
          coreDemographics,
          linkDemographics,
          consolidatedLinkDemographics,
        }).hasNewDemographics
    );
}

export function patientNetworkLinkToNormalizedLinkDemographics(
  patientNetworkLink: PatientNetworkLink
): LinkDemographics {
  const dob = normalizeDob(patientNetworkLink.details.birthDate);
  const gender = normalizeGender(patientNetworkLink.details.gender.code);
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

function getPatientNetworkLinks(linkResults: CwLink[]): PatientNetworkLink[] {
  return linkResults.flatMap(lr => {
    const patientNetworkLink = lr.patient;
    if (!patientNetworkLink) return [];
    return patientNetworkLink;
  });
}

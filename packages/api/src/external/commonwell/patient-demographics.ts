import { Patient } from "@metriport/core/domain/patient";
import { LinkDemographics } from "@metriport/core/domain/patient-demographics";
import { PatientNetworkLink, GenderCodes } from "@metriport/commonwell-sdk";
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
import { CwLink } from "./cw-patient-data";

type CwGenderCode = `${GenderCodes}`;

export function getNewDemographics(patient: Patient, links: CwLink[]): LinkDemographics[] {
  const coreDemographics = patientToNormalizedCoreDemographics(patient);
  const consolidatedLinkDemographics = patient.data.consolidatedLinkDemographics;
  return getPatientNetworkLinks(links)
    .map(patientNetworkLinkToNormalizedLinkDemographics)
    .filter(linkDemographics => scoreLink({ coreDemographics, linkDemographics })[0])
    .filter(linkDemographics =>
      linkHasNewDemographics({
        coreDemographics,
        consolidatedLinkDemographics,
        linkDemographics,
      })
    );
}

function patientNetworkLinkToNormalizedLinkDemographics(
  patientNetworkLink: PatientNetworkLink
): LinkDemographics {
  const dob = normalizeDob(patientNetworkLink.details.birthDate);
  const cwGender = patientNetworkLink.details.gender.code as CwGenderCode;
  const gender = normalizeGender(cwGender);
  const names = (patientNetworkLink.details.name ?? []).flatMap(name => {
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
    telephoneNumbers,
    emails,
    addresses,
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

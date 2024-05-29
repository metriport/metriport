import { Patient } from "@metriport/core/domain/patient";
//import { driversLicenseURIs, ssnURI } from "@metriport/core/domain/oid";
import { NetworkLink, PatientNetworkLink, GenderCodes } from "@metriport/commonwell-sdk";
import {
  LinkDemoDataGender,
  LinkDemoData,
  scoreLink_Epic,
  createAugmentedPatient,
  linkHasNewDemographicData,
  patientToNormalizedAndStringLinkedDemoData,
  normalizeDob,
  normalizeGender,
  normalizeAndStringifyNames,
  normalizeAddress,
  stringifyAddress,
  normalizeTelephone,
  normalizeEmail,
} from "../shared/patient-demographics";
import { getCwPatientData } from "./command/cw-patient-data/get-cw-data";
import { mapGenderAtBirthToFhir } from "@metriport/core/external/fhir/patient/index";

type CwGenderCode = `${GenderCodes}`;

export function checkForNewDemographics(patient: Patient, links: NetworkLink[]): boolean {
  const patientDemographics = patientToNormalizedAndStringLinkedDemoData(patient);
  return getPatientNetworkLinks(links)
    .map(patientNetworkLinkToNormalizedAndStringLinkedDemoData)
    .filter(ld => scoreLink_Epic(patientDemographics, ld))
    .some(ld => linkHasNewDemographicData(patientDemographics, ld));
}

export async function augmentPatientDemographics(patient: Patient): Promise<Patient> {
  const cwData = await getCwPatientData({
    id: patient.id,
    cxId: patient.cxId,
  });
  const links = cwData?.data.links ?? [];
  const patientDemographics = patientToNormalizedAndStringLinkedDemoData(patient);
  const usableLinksDemographics = getPatientNetworkLinks(links)
    .map(patientNetworkLinkToNormalizedAndStringLinkedDemoData)
    .filter(ld => scoreLink_Epic(patientDemographics, ld));
  return createAugmentedPatient(patient, usableLinksDemographics);
}

function patientNetworkLinkToNormalizedAndStringLinkedDemoData(
  patientNetworkLink: PatientNetworkLink
): LinkDemoData {
  const dob = normalizeDob(patientNetworkLink.details.birthDate);
  const cwGender = patientNetworkLink.details.gender.code as CwGenderCode;
  let gender: LinkDemoDataGender = "unknown";
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
  const addressesString = addressesObj.map(addressObj => {
    return stringifyAddress(addressObj);
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

function getPatientNetworkLinks(linkResults: NetworkLink[]): PatientNetworkLink[] {
  return linkResults.flatMap(lr => {
    const patientNetworkLink = lr.patient;
    if (!patientNetworkLink) return [];
    return patientNetworkLink;
  });
}

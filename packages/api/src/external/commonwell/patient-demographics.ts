import { Patient } from "@metriport/core/domain/patient";
//import { driversLicenseURIs, ssnURI } from "@metriport/core/domain/oid";
import { NetworkLink, PatientNetworkLink } from "@metriport/commonwell-sdk";
import {
  LinkDemoData,
  patientToLinkedDemoData,
  scoreLink_Epic,
  createAugmentedPatient,
  linkHasNewDemographicData,
  addressSeparator,
} from "../shared/patient-demographics";
import { getCwPatientData } from "./command/cw-patient-data/get-cw-data";

export function checkForNewDemographics(patient: Patient, links: NetworkLink[]): boolean {
  const patientDemographics = patientToLinkedDemoData(patient);
  return getPatientNetworkLinks(links)
    .map(patientNetworkLinkToLinkedDemoData)
    .filter(ld => scoreLink_Epic(patientDemographics, ld))
    .some(ld => linkHasNewDemographicData(patientDemographics, ld));
}

export async function augmentPatientDemograhpics(patient: Patient): Promise<Patient> {
  const cwData = await getCwPatientData({
    id: patient.id,
    cxId: patient.cxId,
  });
  const links = cwData?.data.links ?? [];
  const patientDemographics = patientToLinkedDemoData(patient);
  const usableLinksDemographics = getPatientNetworkLinks(links)
    .map(patientNetworkLinkToLinkedDemoData)
    .filter(ld => scoreLink_Epic(patientDemographics, ld));
  return createAugmentedPatient(patient, usableLinksDemographics);
}

function getPatientNetworkLinks(linkResults: NetworkLink[]): PatientNetworkLink[] {
  return linkResults.flatMap(lr => {
    const patientNewtorkLink = lr.patient;
    if (!patientNewtorkLink) return [];
    return patientNewtorkLink;
  });
}

function patientNetworkLinkToLinkedDemoData(patientNetworkLink: PatientNetworkLink): LinkDemoData {
  const dob = patientNetworkLink.details.birthDate.trim();
  const gender = patientNetworkLink.details.gender.code.trim().toLowerCase();
  const names = (patientNetworkLink.details.name ?? []).flatMap(name => {
    return name.family.flatMap(lastName => {
      const normalizedLastName = lastName.trim().toLowerCase();
      return (name.given ?? []).map(firstName => {
        return {
          firstName: firstName.trim().toLowerCase(),
          lastName: normalizedLastName,
        };
      });
    });
  });

  const telephoneNumbers = (patientNetworkLink.details.telecom ?? []).flatMap(tc => {
    if (!tc.value || !tc.system) return [];
    if (tc.system !== "phone") return [];
    return [tc.value.trim()];
  });
  const emails = (patientNetworkLink.details.telecom ?? []).flatMap(tc => {
    if (!tc.value || !tc.system) return [];
    if (tc.system !== "email") return [];
    return [tc.value.trim().toLowerCase()];
  });
  const addresses = patientNetworkLink.details.address.map(a => {
    return {
      line: a.line ? a.line.map(l => l.trim().toLowerCase()).join(addressSeparator) : undefined,
      city: a.city?.trim().toLowerCase() ?? undefined,
      state: a.state?.trim().toLowerCase() ?? undefined,
      zip: a.zip.trim(),
      country: a.country?.trim().toLowerCase() ?? undefined,
    };
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
    addresses,
    driversLicenses: [],
    ssns: [],
  };
}

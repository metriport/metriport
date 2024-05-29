import { Patient } from "@metriport/core/domain/patient";
import { InboundPatientResource } from "@metriport/ihe-gateway-sdk";
import {
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
} from "../shared/patient-demographics";
import { getCQPatientData } from "./command/cq-patient-data/get-cq-data";
import { CQLink } from "./cq-patient-data";

export function checkForNewDemographics(patient: Patient, links: CQLink[]): boolean {
  const patientDemographics = patientToNormalizedAndStringLinkedDemoData(patient);
  return getPatientResources(links)
    .map(patientResourceToLinkedDemoData)
    .filter(ld => scoreLink_Epic(patientDemographics, ld))
    .some(ld => linkHasNewDemographicData(patientDemographics, ld));
}

export async function augmentPatientDemographics(patient: Patient): Promise<Patient> {
  const cqData = await getCQPatientData({
    id: patient.id,
    cxId: patient.cxId,
  });
  const links = cqData?.data.links ?? [];
  const patientDemographics = patientToNormalizedAndStringLinkedDemoData(patient);
  const usableLinksDemographics = getPatientResources(links)
    .map(patientResourceToLinkedDemoData)
    .filter(ld => scoreLink_Epic(patientDemographics, ld));
  return createAugmentedPatient(patient, usableLinksDemographics);
}

function patientResourceToLinkedDemoData(patientResource: InboundPatientResource): LinkDemoData {
  const dob = normalizeDob(patientResource.birthDate ?? "");
  const gender = normalizeGender(patientResource.gender ?? "");
  const names = (patientResource.name ?? []).flatMap(name => {
    if (!name.family) return [];
    const lastName = name.family.trim().toLowerCase();
    return (name.given ?? []).map(firstName => {
      return normalizeAndStringifyNames({ firstName, lastName });
    });
  });
  const addressesObj = patientResource.address.map(a => {
    return normalizeAddress({
      line: a.line,
      city: a.city,
      state: a.state,
      zip: a.postalCode,
      country: a.country,
    });
  });
  const addressesString = addressesObj.map(addressObj => {
    return stringifyAddress(addressObj);
  });
  /* TODO
  const telephoneNumbers = (patientResource.contact ?? []).flatMap(c => {
  });
  const emails = (patientResource.contact ?? []).flatMap(c => {
  })
  const driversLicenses = (patientResource.personalIdentifiers ?? []).flatMap(p => { 
  });
  const ssns = (ppatientResource.personalIdentifiers ?? []).flatMap(p => { 
  });
  */
  return {
    dob,
    gender,
    names,
    telephoneNumbers: [],
    emails: [],
    addressesObj,
    addressesString,
    driversLicenses: [],
    ssns: [],
  };
}

function getPatientResources(linkResults: CQLink[]): InboundPatientResource[] {
  return linkResults.flatMap(lr => {
    const patientResource = lr.patientResource;
    if (!patientResource) return [];
    return patientResource;
  });
}

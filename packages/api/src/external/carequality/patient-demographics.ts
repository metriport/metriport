import { Patient } from "@metriport/core/domain/patient";
import { LinkDemographics } from "@metriport/core/domain/patient-demographics";
import { InboundPatientResource } from "@metriport/ihe-gateway-sdk";
import {
  scoreLinkEpic,
  linkHasNewDemographiscData,
  patientCoreDemographicsToNormalizedAndStringifiedLinkDemographics,
  normalizeDob,
  normalizeGender,
  normalizeAndStringifyNames,
  normalizeAddress,
  stringifyAddress,
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
  patientResource: InboundPatientResource
): LinkDemographics {
  const dob = normalizeDob(patientResource.birthDate ?? "");
  const gender = normalizeGender(patientResource.gender ?? "");
  const names = (patientResource.name ?? []).flatMap(name => {
    if (!name.family) return [];
    const lastName = name.family;
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
  const addressesString = addressesObj.map(stringifyAddress);
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

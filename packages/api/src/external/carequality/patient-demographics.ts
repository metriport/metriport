import { Patient } from "@metriport/core/domain/patient";
import { InboundPatientResource } from "@metriport/ihe-gateway-sdk";
import {
  LinkDemoData,
  patientToLinkedDemoData,
  scoreLink,
  createAugmentedPatient,
  linkHasNewDemographicData,
  addressSeparator,
} from "../shared/patient-demographics";
import { getCQPatientData } from "./command/cq-patient-data/get-cq-data";
import { CQLink } from "./cq-patient-data";

export function checkForNewDemographics(patient: Patient, links: CQLink[]): boolean {
  const patientDemographics = patientToLinkedDemoData(patient);
  return getPatientResources(links)
    .map(patientResourceToLinkedDemoData)
    .filter(ld => scoreLink(patientDemographics, ld))
    .some(ld => linkHasNewDemographicData(patientDemographics, ld));
}

export async function augmentPatientDemograhpics(patient: Patient): Promise<Patient> {
  const cqData = await getCQPatientData({
    id: patient.id,
    cxId: patient.cxId,
  });
  const links = cqData?.data.links ?? [];
  const patientDemographics = patientToLinkedDemoData(patient);
  const usableLinksDemographics = getPatientResources(links)
    .map(patientResourceToLinkedDemoData)
    .filter(ld => scoreLink(patientDemographics, ld));
  return createAugmentedPatient(patient, usableLinksDemographics);
}

function getPatientResources(pdResults: CQLink[]): InboundPatientResource[] {
  return pdResults.flatMap(cq => {
    const patientResource = cq.patientResource;
    if (!patientResource) return [];
    return patientResource;
  });
}

function patientResourceToLinkedDemoData(patientResource: InboundPatientResource): LinkDemoData {
  const dob = patientResource.birthDate?.trim();
  const gender = patientResource.gender?.trim().toLowerCase();
  const names = (patientResource.name ?? []).flatMap(name => {
    if (!name.family) return [];
    const lastName = name.family.trim().toLowerCase();
    return (name.given ?? []).map(firstName => {
      return {
        firstName: firstName.trim().toLowerCase(),
        lastName,
      };
    });
  });
  /* TODO
  const telephoneNumbers = (patientResource.contact ?? []).flatMap(c => {
  });
  const emails = (patientResource.contact ?? []).flatMap(c => {
  })
  */
  const addresses = patientResource.address.map(a => {
    return {
      line: a.line ? a.line.map(l => l.trim().toLowerCase()).join(addressSeparator) : undefined,
      city: a.city?.trim().toLowerCase() ?? undefined,
      state: a.state?.trim().toLowerCase() ?? undefined,
      zip: a.postalCode?.trim() ?? undefined,
      country: a.country?.trim().toLowerCase() ?? undefined,
    };
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
    telephoneNumbers: [],
    emails: [],
    addresses,
    driversLicenses: [],
    ssns: [],
  };
}

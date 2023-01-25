#!/usr/bin/env node
import { CommonWell, getIdPatient, RequestMetadata, getId } from "@metriport/commonwell-sdk";

import { patient, mergePatient, personStrongId } from "./payloads";

// 2. Patient Management
// https://commonwellalliance.sharepoint.com/sites/ServiceAdopter/SitePages/Patient-Management-(PIX,-REST).aspx

export async function patientManagement(commonWell: CommonWell, queryMeta: RequestMetadata) {
  console.log(`>>> D1b: Register a new Patient`);
  const respD1b = await commonWell.registerPatient(queryMeta, patient);
  console.log(respD1b);

  console.log(`>>> D2a: Update demographics for a local Patient `);
  patient.details.name[0].family[0] = "Graham";
  const patientId = getIdPatient(respD1b);
  const respD2a = await commonWell.updatePatient(queryMeta, patient, patientId);
  console.log(respD2a);

  console.log(`>>> D3a: ​Search for a Patient`);
  const respD3a = await commonWell.searchPatient(
    queryMeta,
    patient.details.name[0].given[0],
    patient.details.name[0].family[0],
    patient.details.birthDate,
    patient.details.gender.code,
    patient.details.address[0].zip
  );
  console.log(respD3a);

  console.log(`>>> D4a: Merge two Patient records`);
  // Create a second patient
  const respPatient2 = await commonWell.registerPatient(queryMeta, mergePatient);
  const patientId2 = getIdPatient(respPatient2);
  const referenceLink = respD1b._links.self.href;

  await commonWell.mergePatients(queryMeta, patientId2, referenceLink);
  console.log("D4a successful");

  console.log(`>>> D5a: Retrieve network links`);
  const person = await commonWell.enrollPerson(queryMeta, personStrongId);
  const personId = getId(person);
  await commonWell.patientLink(queryMeta, personId, referenceLink);
  const respD5a = await commonWell.getPatientsLinks(queryMeta, patientId);
  console.log(respD5a);

  // Deletes created patients (not a part of spec just for cleanup)
  console.log(`>>> Delete created patients.`);

  // Note: will be deleting patient & person created in this run
  await commonWell.deletePatient(queryMeta, patientId);
  await commonWell.deletePerson(queryMeta, patientId);
}

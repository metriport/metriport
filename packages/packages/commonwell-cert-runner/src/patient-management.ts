#!/usr/bin/env node
import { CommonWell, getIdTrailingSlash, RequestMetadata, getId } from "@metriport/commonwell-sdk";
import { cloneDeep } from "lodash";

import { patient, mergePatient, personStrongId } from "./payloads";

import { getEnvOrFail } from "./util";

const commonwellSandboxOID = getEnvOrFail("COMMONWELL_SANDBOX_OID");
const commonwellSandboxOrgName = getEnvOrFail("COMMONWELL_SANDBOX_ORG_NAME");

// 2. Patient Management
// https://commonwellalliance.sharepoint.com/sites/ServiceAdopter/SitePages/Patient-Management-(PIX,-REST).aspx

export async function patientManagement(
  commonWell: CommonWell,
  commonwellSandbox: CommonWell,
  queryMeta: RequestMetadata
) {
  // PATIENT MANAGEMENT
  console.log(`>>> D1b: Register a new Patient`);
  const respD1b = await commonWell.registerPatient(queryMeta, patient);
  console.log(respD1b);

  console.log(`>>> D2a: Update demographics for a local Patient `);
  patient.details.name[0].family[0] = "Graham";
  const patientId = getIdTrailingSlash(respD1b);
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
  const patientId2 = getIdTrailingSlash(respPatient2);
  const referenceLink = respD1b._links.self.href;

  await commonWell.mergePatients(queryMeta, patientId2, referenceLink);
  console.log("D4a successful");

  // LINK MANAGEMENT
  // D5: Patient Matches
  console.log(`>>> D5a: Retrieve network links`);
  // Main Account Link
  const person = await commonWell.enrollPerson(queryMeta, personStrongId);
  const personId = getId(person);
  await commonWell.patientLink(queryMeta, personId, referenceLink);
  // Sandbox Account Link
  let payloadSandboxPatient = cloneDeep(patient);
  payloadSandboxPatient.identifier[0].system = `urn:oid:${commonwellSandboxOID}`;
  payloadSandboxPatient.identifier[0].assigner = commonwellSandboxOrgName;
  payloadSandboxPatient.identifier[0].label = commonwellSandboxOrgName;
  const sandboxPatient = await commonwellSandbox.registerPatient(queryMeta, payloadSandboxPatient);
  const sandboxPatientId = getIdTrailingSlash(sandboxPatient);
  const sandboxReferenceLink = sandboxPatient._links.self.href;
  await commonwellSandbox.patientLink(queryMeta, personId, sandboxReferenceLink);
  await commonWell.searchPersonByPatientDemo(queryMeta, patientId);
  const respD5a = await commonWell.getPatientsLinks(queryMeta, patientId);
  console.log(respD5a);

  // D6: Upgrade/Downgrade a Network link
  console.log(`>>> D6a: Upgrade link from LOLA 1 to LOLA 2`);
  const getLola1Link = respD5a._embedded.networkLink.find(link => link.assuranceLevel === "1");
  const respD6a = await commonWell.upgradeOrDowngradePatientLink(
    queryMeta,
    getLola1Link._links.upgrade.href
  );
  console.log(respD6a);

  console.log(`>>> D6b: Downgrade link from LOLA 2 to LOLA 0`);
  const respD6b = await commonWell.upgradeOrDowngradePatientLink(
    queryMeta,
    respD6a._links.downgrade.href
  );
  console.log(respD6b);

  // Deletes created patients (not a part of spec just for cleanup)
  console.log(`>>> Delete created patients.`);

  // Note: will be deleting patient & person created in this run
  await commonWell.deletePerson(queryMeta, personId);
  await commonWell.deletePatient(queryMeta, patientId);
  await commonwellSandbox.deletePatient(queryMeta, sandboxPatientId);
}

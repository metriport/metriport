#!/usr/bin/env node
import {
  CommonWell,
  getId,
  getIdTrailingSlash,
  LOLA,
  RequestMetadata,
} from "@metriport/commonwell-sdk";
import { cloneDeep } from "lodash";

import { makeMergePatient, makePatient, personStrongId } from "./payloads";

import { firstElementOrFail, getEnvOrFail } from "./util";

const commonwellSandboxOID = getEnvOrFail("COMMONWELL_SANDBOX_OID");
const commonwellSandboxOrgName = getEnvOrFail("COMMONWELL_SANDBOX_ORG_NAME");

// 2. Patient Management
// https://commonwellalliance.sharepoint.com/sites/ServiceAdopter/SitePages/Patient-Management-(PIX,-REST).aspx

export async function patientManagement(
  commonWell: CommonWell,
  commonwellSandbox: CommonWell,
  queryMeta: RequestMetadata
) {
  const patient = makePatient({ facilityId: commonWell.oid });

  // PATIENT MANAGEMENT
  console.log(`>>> D1b: Register a new Patient`);
  const respD1b = await commonWell.registerPatient(queryMeta, patient);
  console.log(respD1b);

  console.log(`>>> D2a: Update demographics for a local Patient `);
  patient.details.name[0].family[0] = "Graham";
  const patientId = getIdTrailingSlash(respD1b);
  if (!patientId) throw new Error("No patientId on response from registerPatient");
  const respD2a = await commonWell.updatePatient(queryMeta, patient, patientId);
  console.log(respD2a);

  console.log(`>>> D3a: Search for a Patient`);
  const respD3a = await commonWell.searchPatient(
    queryMeta,
    firstElementOrFail(patient.details.name[0].given, "given name"),
    patient.details.name[0].family[0],
    patient.details.birthDate,
    patient.details.gender.code,
    patient.details.address[0].zip
  );
  console.log(respD3a);

  console.log(`>>> D4a: Merge two Patient records`);
  // Create a second patient
  const respPatient2 = await commonWell.registerPatient(
    queryMeta,
    makeMergePatient({ facilityId: commonWell.oid })
  );
  const patientId2 = getIdTrailingSlash(respPatient2);
  if (!patientId2) throw new Error("No patientId on response from registerPatient");
  const referenceLink = respD1b._links?.self.href;
  if (!referenceLink) throw new Error("No referenceLink on response from registerPatient");

  await commonWell.mergePatients(queryMeta, patientId2, referenceLink);
  console.log("D4a successful");

  // LINK MANAGEMENT
  // D5: Patient Matches
  console.log(`>>> D5a: Retrieve network links`);
  // Main Account Link
  const person = await commonWell.enrollPerson(queryMeta, personStrongId);
  const personId = getId(person);
  if (!personId) throw new Error("No personId on response from enrollPerson");
  await commonWell.addPatientLink(queryMeta, personId, referenceLink);
  // Sandbox Account Link
  const payloadSandboxPatient = cloneDeep(patient);

  if (payloadSandboxPatient.identifier) {
    payloadSandboxPatient.identifier[0].system = `urn:oid:${commonwellSandboxOID}`;
    payloadSandboxPatient.identifier[0].assigner = commonwellSandboxOrgName;
    payloadSandboxPatient.identifier[0].label = commonwellSandboxOrgName;
  }
  const sandboxPatient = await commonwellSandbox.registerPatient(queryMeta, payloadSandboxPatient);
  const sandboxPatientId = getIdTrailingSlash(sandboxPatient);
  if (!sandboxPatientId) throw new Error("No sandboxPatientId on response from registerPatient");
  const sandboxReferenceLink = sandboxPatient._links?.self.href;
  if (!sandboxReferenceLink) {
    throw new Error("No sandboxReferenceLink on response from registerPatient");
  }
  await commonwellSandbox.addPatientLink(queryMeta, personId, sandboxReferenceLink);
  await commonWell.searchPersonByPatientDemo(queryMeta, patientId);
  const respD5a = await commonWell.getNetworkLinks(queryMeta, patientId);
  console.log(respD5a);

  // D6: Upgrade/Downgrade a Network link
  console.log(`>>> D6a: Upgrade link from LOLA 1 to LOLA 2`);
  const getLola1Link = respD5a._embedded.networkLink?.find(
    link => link && link.assuranceLevel === LOLA.level_1
  );
  const upgradeURL = getLola1Link?._links?.upgrade?.href;
  if (!upgradeURL) throw new Error("No upgradeURL on response from getNetworkLinks");
  const respD6a = await commonWell.upgradeOrDowngradeNetworkLink(queryMeta, upgradeURL);
  console.log(respD6a);

  console.log(`>>> D6b: Downgrade link from LOLA 2 to LOLA 0`);
  const downgradeURL = respD6a._links?.downgrade?.href;
  if (!downgradeURL) {
    throw new Error("No downgradeURL on response from upgradeOrDowngradeNetworkLink");
  }
  const respD6b = await commonWell.upgradeOrDowngradeNetworkLink(queryMeta, downgradeURL);
  console.log(respD6b);

  // Deletes created patients (not a part of spec just for cleanup)
  console.log(`>>> Delete created patients.`);

  // Note: will be deleting patient & person created in this run
  await commonWell.deletePerson(queryMeta, personId);
  await commonWell.deletePatient(queryMeta, patientId);
  await commonwellSandbox.deletePatient(queryMeta, sandboxPatientId);
}

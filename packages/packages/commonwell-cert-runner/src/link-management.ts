#!/usr/bin/env node
import { CommonWell, getPatientId, RequestMetadata, getId } from "@metriport/commonwell-sdk";

import { patient, identifier, personStrongId } from "./payloads";

// 3. Link Management
// https://commonwellalliance.sharepoint.com/sites/ServiceAdopter/SitePages/Patient-Management-(PIX,-REST).aspx

export async function linkManagement(commonWell: CommonWell, queryMeta: RequestMetadata) {
  // C5: ​Levels of Link Assurance
  console.log(`>>> ​C5a : Link a Patient to a Person upgrading from LOLA 1 to LOLA 2.`);
  const person = await commonWell.enrollPerson(queryMeta, personStrongId);
  const personId = getId(person);

  const respPatient = await commonWell.registerPatient(queryMeta, patient);
  const patientId = getPatientId(respPatient);
  const referenceLink = respPatient._links.self.href;
  const respC5a = await commonWell.patientLink(queryMeta, personId, referenceLink);
  console.log(respC5a);

  console.log(`>>> ​C5b : ​Upgrade Patient link from LOLA 2 to LOLA 3 (with Strong ID).`);
  const respC5b = await commonWell.updatePatientLink(
    queryMeta,
    respC5a._links.self.href,
    respPatient._links.self.href,
    identifier
  );
  console.log(respC5b);

  console.log(`>>> ​C5c : ​Downgrade Patient link from LOLA 3 to LOLA 2 (without Strong ID).`);
  const respC5c = await commonWell.updatePatientLink(
    queryMeta,
    respC5a._links.self.href,
    respPatient._links.self.href,
    null
  );
  console.log(respC5c);

  console.log(`>>> ​C5a : ​Delete Patient/Person link that exists as LOLA 2.`);
  await commonWell.deletePatientLink(queryMeta, respC5c._links.self.href);

  // Note: will be deleting patient & person created in this run
  await commonWell.deletePerson(queryMeta, personId);
  await commonWell.deletePatient(queryMeta, patientId);
}

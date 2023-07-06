#!/usr/bin/env node
import { CommonWell, getId, getIdTrailingSlash, RequestMetadata } from "@metriport/commonwell-sdk";

import { identifier, makePatient, personStrongId } from "./payloads";

// 3. Link Management
// https://commonwellalliance.sharepoint.com/sites/ServiceAdopter/SitePages/Patient-Management-(PIX,-REST).aspx

export async function linkManagement(commonWell: CommonWell, queryMeta: RequestMetadata) {
  // C5: Levels of Link Assurance
  console.log(`>>> C5a : Link a Patient to a Person upgrading from LOLA 1 to LOLA 2.`);
  const person = await commonWell.enrollPerson(queryMeta, personStrongId);
  const personId = getId(person);
  if (!personId) throw new Error("No personId on response from enrollPerson");

  const respPatient = await commonWell.registerPatient(
    queryMeta,
    makePatient({ facilityId: commonWell.oid })
  );
  const patientUri = respPatient._links?.self.href;
  if (!patientUri) throw new Error("No patientUri on response from registerPatient");
  const patientId = getIdTrailingSlash(respPatient);
  if (!patientId) throw new Error("No patientId on response from registerPatient");
  const referenceLink = respPatient._links?.self.href;
  if (!referenceLink) throw new Error("No referenceLink on response from registerPatient");
  const respC5a = await commonWell.addPatientLink(queryMeta, personId, referenceLink);
  console.log(respC5a);
  const patientLinkUri = respC5a._links?.self?.href;
  if (!patientLinkUri) throw new Error("No patientLinkUri on response from addPatientLink");

  console.log(`>>> C5b : Upgrade Patient link from LOLA 2 to LOLA 3 (with Strong ID).`);
  const respC5b = await commonWell.updatePatientLink(
    queryMeta,
    patientLinkUri,
    patientUri,
    identifier
  );
  console.log(respC5b);

  console.log(`>>> C5c : Downgrade Patient link from LOLA 3 to LOLA 2 (without Strong ID).`);
  const respC5c = await commonWell.updatePatientLink(queryMeta, patientLinkUri, patientUri);
  console.log(respC5c);
  const patientLinkFromUpdate = respC5c._links?.self.href;
  if (!patientLinkFromUpdate)
    throw new Error("No patientLinkFromUpdate on response from updatePatientLink");

  console.log(`>>> C5a : Delete Patient/Person link that exists as LOLA 2.`);
  await commonWell.deletePatientLink(queryMeta, patientLinkFromUpdate);

  // Note: will be deleting patient & person created in this run
  await commonWell.deletePerson(queryMeta, personId);
  await commonWell.deletePatient(queryMeta, patientId);
}

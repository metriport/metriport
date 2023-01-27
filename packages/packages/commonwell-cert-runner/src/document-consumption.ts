#!/usr/bin/env node
import {
  CommonWell,
  getPatientId,
  getPersonIdFromSearchByPatientDemo,
  RequestMetadata,
} from "@metriport/commonwell-sdk";
import { getEnvOrFail } from "./util";

// Document Consumption
// https://commonwellalliance.sharepoint.com/sites/ServiceAdopter/SitePages/Document-Consumption-(SOAP,-REST).aspx

const patientFirstName = getEnvOrFail("DOCUMENT_PATIENT_FIRST_NAME");
const patientLastName = getEnvOrFail("DOCUMENT_PATIENT_LAST_NAME");
const patientDateOfBirth = getEnvOrFail("DOCUMENT_PATIENT_DATE_OF_BIRTH");

export async function documentConsumption(commonWell: CommonWell, queryMeta: RequestMetadata) {
  // E1: Document Query

  console.log(`>>> E1c: Query for documents using FHIR (REST)`);
  console.log(`... [E1c] Search for a Patient`);
  const patientResponse = await commonWell.searchPatient(
    queryMeta,
    patientFirstName,
    patientLastName,
    patientDateOfBirth
    // patientGender,
    // patientZip
  );
  console.log(patientResponse);
  if (!patientResponse._embedded || !patientResponse._embedded.patient) return undefined;
  const embeddedPatients = patientResponse._embedded.patient.filter(p => p.active);
  if (embeddedPatients.length < 1) return undefined;
  if (embeddedPatients.length > 1) {
    console.log(`Found more than one patient, using the first one: `, patientResponse);
  }
  const patient = embeddedPatients[0];
  console.log(`... [E1c] Patient: `, patient);

  const patientId = getPatientId(patient);
  console.log(`... [E1c] patientId: ${patientId}`);

  const networkLinks = await commonWell.getPatientsLinks(queryMeta, patientId);
  if (!networkLinks._links || !networkLinks._links.self) {
    // Create/link a patient
    console.log(`... [E1c] No network link, building one...`);
    const personRes = await commonWell.searchPersonByPatientDemo(queryMeta, patientId);
    console.log(personRes);
    const personId = getPersonIdFromSearchByPatientDemo(personRes);
    console.log(`... [E1c] personId: ${personId}`);
    const patientLink = patient._links.self.href;
    console.log(`... [E1c] patientLink: ${patientLink}`);
    const linkResponse = await commonWell.patientLink(queryMeta, personId, patientLink);
    console.log(linkResponse);
  } else {
    console.log(`... [E1c] Already has a network link! `, networkLinks._links.self);
  }
  console.log(`... [E1c] WOULD BE QUERYING FOR DOCS NOW...`);

  // Link the patient to a document from the sandbox
  // const documentId = "XXXXXXXXXXXXXXX";
  // // TODO CONTINUE...

  // // Query for the document
  // const respE1c = await commonWell.queryDocument(queryMeta, driversLicenseId, caDriversLicenseUri);
  // console.log(respE1c);
  // const documentId = getDocumentId(respE1c);

  // // E2: Document Retrieve

  // console.log(`>>> E2c: Retrieve documents using FHIR (REST)`);
  // const respE2c = await commonWell.retrieveDocument(
  //   queryMeta,
  //   driversLicenseId,
  //   caDriversLicenseUri
  // );
  // console.log(respE2c);

  // TODO anything special to indicate the document we retrieved?

  // console.log(`>>> E1c: Delete a Person who we enrolled and at least one patient link.`);
  // await commonWell.deletePerson(queryMeta, personId);
}

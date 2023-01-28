#!/usr/bin/env node
import {
  CommonWell,
  convertPatiendIdToDocQuery,
  getId,
  getPatientId,
  isLOLA1,
  RequestMetadata,
} from "@metriport/commonwell-sdk";
import { docPatient, docPerson } from "./payloads";

// Document Consumption
// https://commonwellalliance.sharepoint.com/sites/ServiceAdopter/SitePages/Document-Consumption-(SOAP,-REST).aspx

export async function documentConsumption(commonWell: CommonWell, queryMeta: RequestMetadata) {
  let personId: string | undefined = undefined;
  let patientId: string | undefined = undefined;
  try {
    // E1: Document Query

    console.log(`>>> E1c: Query for documents using FHIR (REST)`);

    console.log(`... Enroll a Person with a Strong ID`);
    const respPerson = await commonWell.enrollPerson(queryMeta, docPerson);
    console.log(respPerson);
    personId = getId(respPerson);
    console.log(`... personId: ${personId}`);

    console.log(`... Search for a Patient`);
    const patientResponse = await commonWell.searchPatient(
      queryMeta,
      docPerson.details.name[0].given[0],
      docPerson.details.name[0].family[0],
      docPerson.details.birthDate
    );
    console.log(patientResponse);
    let patient;

    // IF THERE'S A PATIENT, GET IT
    if (
      patientResponse._embedded &&
      patientResponse._embedded.patient &&
      patientResponse._embedded.patient.length > 0
    ) {
      console.log(`... FOUND PATIENT, USING IT...`);
      // const embeddedPatients = patientResponse._embedded.patient.filter(p => p.active);
      const embeddedPatients = patientResponse._embedded.patient;
      // if (embeddedPatients.length < 1) return undefined;
      if (embeddedPatients.length > 1) {
        console.log(`Found more than one patient, using the first one: `, patientResponse);
      }
      patient = embeddedPatients[0];
      console.log(`... Patient: `, patient);
      patientId = getPatientId(patient);
      console.log(`... patientId: ${patientId}`);

      // const networkLinks = await commonWell.getPatientsLinks(queryMeta, patientId);
      // if (!networkLinks._links || !networkLinks._links.self) {
      //   // Create/link a patient
      //   console.log(`... No network link, building one...`);
      //   // const personRes = await commonWell.searchPersonByPatientDemo(queryMeta, patientId);
      //   // console.log(personRes);
      //   // const personId = getPersonIdFromSearchByPatientDemo(personRes);
      //   // console.log(`... [E1c] personId: ${personId}`);
      //   const patientLink = patient._links.self.href;
      //   console.log(`... patientLink: ${patientLink}`);
      //   const linkResponse = await commonWell.patientLink(queryMeta, personId, patientLink);
      //   console.log(linkResponse);
      // } else {
      //   console.log(`... Already has a network link! `, networkLinks._links.self);
      // }

      //
    } else {
      // OTHERWISE ADD ONE
      console.log(`... DID NOT FOUND PATIENT`);

      console.log(`... Register a new Patient`);
      const respPatient = await commonWell.registerPatient(queryMeta, docPatient);
      console.log(respPatient);
      patientId = getPatientId(respPatient);
      console.log(`... patientId: ${patientId}`);

      console.log(`... Link a Patient to a Person upgrading from LOLA 1 to LOLA 2.`);
      const patientLink = respPatient._links.self.href;
      const respLink = await commonWell.patientLink(queryMeta, personId, patientLink);
      console.log(respLink);

      // console.log(`... Upgrade Patient link from LOLA 2 to LOLA 3 (with Strong ID).`);
      // const respC5b = await commonWell.updatePatientLink(
      //   queryMeta,
      //   respLink._links.self.href,
      //   patientLink,
      //   docIdentifier
      // );
      // console.log(respC5b);
    }

    // const networkLinks = await commonWell.getPatientsLinks(queryMeta, patientId);
    // if (!networkLinks._links || !networkLinks._links.self) {
    //   // Create/link a patient
    //   console.log(`... [E1c] No network link, building one...`);
    //   // const personRes = await commonWell.searchPersonByPatientDemo(queryMeta, patientId);
    //   // console.log(personRes);
    //   // const personId = getPersonIdFromSearchByPatientDemo(personRes);
    //   // console.log(`... [E1c] personId: ${personId}`);
    //   const patientLink = patient._links.self.href;
    //   console.log(`... [E1c] patientLink: ${patientLink}`);
    //   const linkResponse = await commonWell.patientLink(queryMeta, personId, patientLink);
    //   console.log(linkResponse);
    // } else {
    //   console.log(`... [E1c] Already has a network link! `, networkLinks._links.self);
    // }

    // ###########################################################

    // console.log(`... Enroll a Person with a Strong ID`);
    // const respPerson = await commonWell.enrollPerson(queryMeta, docPerson);
    // console.log(respPerson);
    // personId = getId(respPerson);
    // console.log(`... personId: ${personId}`);

    // console.log(`... Register a new Patient`);
    // const respPatient = await commonWell.registerPatient(queryMeta, docPatient);
    // console.log(respPatient);
    // patientId = getPatientId(respPatient);
    // console.log(`... patientId: ${patientId}`);

    // console.log(`... Link a Patient to a Person upgrading from LOLA 1 to LOLA 2.`);
    // const patientLink = respPatient._links.self.href;
    // const respLink = await commonWell.patientLink(queryMeta, personId, patientLink);
    // console.log(respLink);

    // REMOVED WHEN WORKED
    // console.log(`>>> C5b : Upgrade Patient link from LOLA 2 to LOLA 3 (with Strong ID).`);
    // const respC5b = await commonWell.updatePatientLink(
    //   queryMeta,
    //   respLink._links.self.href,
    //   patientLink,
    //   docIdentifier
    // );
    // console.log(respC5b);

    // ###########################################################

    console.log(`... Get Network links`);
    const respLinks = await commonWell.getPatientsLinks(queryMeta, patientId);
    console.log(respLinks);
    const allLinks = respLinks._embedded.networkLink;
    const lola1Links = allLinks.filter(isLOLA1);
    console.log(`... Found ${allLinks.length} network links, ${lola1Links.length} are LOLA 1`);
    for (const link of lola1Links) {
      console.log(`... Upgrade link from LOLA 1 to LOLA 2`);
      const respUpgradeLink = await commonWell.upgradeOrDowngradePatientLink(
        queryMeta,
        link._links.upgrade.href
      );
      console.log(respUpgradeLink);
    }

    const patientIdForDocQuery = convertPatiendIdToDocQuery(patientId);
    if (!patientIdForDocQuery) {
      throw new Error(`[E1c] Could not find patientId for doc query`);
    }
    console.log(`... patientIdForDocQuery: ${patientIdForDocQuery}`);

    console.log(`... [E1c] Querying for docs...`);
    const respDocQuery = await commonWell.queryDocument(queryMeta, patientIdForDocQuery);
    console.log(respDocQuery);

    //
  } finally {
    try {
      console.log(`... Delete created person...`);
      personId && (await commonWell.deletePerson(queryMeta, personId));
    } catch (err) {
      console.log(`Failed to delete person ${personId}`, err);
    }
    try {
      console.log(`... Delete created patient...`);
      patientId && (await commonWell.deletePatient(queryMeta, patientId));
    } catch (err) {
      console.log(`Failed to delete patient ${patientId}`, err);
    }
  }
}

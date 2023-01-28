#!/usr/bin/env node
import {
  CommonWell,
  convertPatiendIdToDocQuery,
  getId,
  getPatientId,
  isLOLA1,
  RequestMetadata,
} from "@metriport/commonwell-sdk";
import { identifier, mainDetails, patient, personStrongId } from "./payloads";
import { getEnvOrFail } from "./util";

// Document Consumption
// https://commonwellalliance.sharepoint.com/sites/ServiceAdopter/SitePages/Document-Consumption-(SOAP,-REST).aspx

const patientFirstName = getEnvOrFail("DOCUMENT_PATIENT_FIRST_NAME");
const patientLastName = getEnvOrFail("DOCUMENT_PATIENT_LAST_NAME");
const patientDateOfBirth = getEnvOrFail("DOCUMENT_PATIENT_DATE_OF_BIRTH");

export async function documentConsumption(commonWell: CommonWell, queryMeta: RequestMetadata) {
  let personId: string | undefined = undefined;
  let patientId: string | undefined = undefined;
  try {
    // E1: Document Query

    console.log(`>>> E1c: Query for documents using FHIR (REST)`);

    // console.log(`... [E1c] Search for a Patient`);
    // const patientResponse = await commonWell.searchPatient(
    //   queryMeta,
    //   patientFirstName,
    //   patientLastName,
    //   patientDateOfBirth
    // );
    // console.log(patientResponse);
    // if (!patientResponse._embedded || !patientResponse._embedded.patient) return undefined;
    // const embeddedPatients = patientResponse._embedded.patient.filter(p => p.active);
    // if (embeddedPatients.length < 1) return undefined;
    // if (embeddedPatients.length > 1) {
    //   console.log(`Found more than one patient, using the first one: `, patientResponse);
    // }
    // const patient = embeddedPatients[0];
    // console.log(`... [E1c] Patient: `, patient);

    // const patientId = getPatientId(patient);
    // console.log(`... [E1c] patientId: ${patientId}`);

    // const networkLinks = await commonWell.getPatientsLinks(queryMeta, patientId);
    // if (!networkLinks._links || !networkLinks._links.self) {
    //   // Create/link a patient
    //   console.log(`... [E1c] No network link, building one...`);
    //   const personRes = await commonWell.searchPersonByPatientDemo(queryMeta, patientId);
    //   console.log(personRes);
    //   const personId = getPersonIdFromSearchByPatientDemo(personRes);
    //   console.log(`... [E1c] personId: ${personId}`);
    //   const patientLink = patient._links.self.href;
    //   console.log(`... [E1c] patientLink: ${patientLink}`);
    //   const linkResponse = await commonWell.patientLink(queryMeta, personId, patientLink);
    //   console.log(linkResponse);
    // } else {
    //   console.log(`... [E1c] Already has a network link! `, networkLinks._links.self);
    // }

    console.log(`>>> C1a: Enroll a Person with a Strong ID`);
    const details = {
      name: [
        {
          ...mainDetails.name[0],
          given: [patientFirstName],
          family: [patientLastName],
        },
      ],
      birthDate: patientDateOfBirth,
      address: [
        {
          ...mainDetails.address[0],
          zip: "62731",
        },
      ],
    };
    const personPayload = {
      ...personStrongId,
      details: {
        ...personStrongId.details,
        ...details,
      },
    };
    console.log(JSON.stringify(personPayload, undefined, 2));
    const respPerson = await commonWell.enrollPerson(queryMeta, personPayload);
    console.log(respPerson);
    personId = getId(respPerson);
    console.log(`... personId: ${personId}`);

    console.log(`>>> D1b: Register a new Patient`);
    const patientPayload = {
      ...patient,
      details: {
        ...patient.details,
        ...details,
      },
    };
    console.log(JSON.stringify(patientPayload, undefined, 2));
    const respPatient = await commonWell.registerPatient(queryMeta, patientPayload);
    console.log(respPatient);
    patientId = getPatientId(respPatient);
    console.log(`... patientId: ${patientId}`);

    console.log(`>>> C5a : Link a Patient to a Person upgrading from LOLA 1 to LOLA 2.`);
    const referenceLink = respPatient._links.self.href;
    const respLink = await commonWell.patientLink(queryMeta, personId, referenceLink);
    console.log(respLink);

    console.log(`>>> C5b : Upgrade Patient link from LOLA 2 to LOLA 3 (with Strong ID).`);
    const respC5b = await commonWell.updatePatientLink(
      queryMeta,
      respLink._links.self.href,
      respPatient._links.self.href,
      identifier
    );
    console.log(respC5b);

    console.log(`>>> D6a: Get Network links`);
    const respLinks = await commonWell.getPatientsLinks(queryMeta, patientId);
    console.log(respLinks);
    console.log(`>>> D6a: Upgrade link from LOLA 1 to LOLA 2`);
    const allLinks = respLinks._embedded.networkLink;
    const lola1Links = allLinks.filter(isLOLA1);
    console.log(`Found ${allLinks.length} network links, ${lola1Links.length} are LOLA 1`);
    for (const link of lola1Links) {
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
    console.log(`... [E1c] patientIdForDocQuery: ${patientIdForDocQuery}`);

    console.log(`... [E1c] Querying for docs...`);
    const respDocQuery = await commonWell.queryDocument(queryMeta, patientIdForDocQuery);
    console.log(JSON.stringify(respDocQuery));
  } finally {
    try {
      console.log(`>>> Delete created person...`);
      personId && (await commonWell.deletePerson(queryMeta, personId));
    } catch (err) {
      console.log(`Failed to delete person ${personId}`, err);
    }
    try {
      console.log(`>>> Delete created patient...`);
      patientId && (await commonWell.deletePatient(queryMeta, patientId));
    } catch (err) {
      console.log(`Failed to delete patient ${patientId}`, err);
    }
  }
}

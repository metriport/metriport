#!/usr/bin/env node
import {
  CommonWell,
  Document,
  getId,
  getIdTrailingSlash,
  isLOLA1,
  RequestMetadata,
} from "@metriport/commonwell-sdk";
import {
  getPatientStrongIds,
  getPersonIdFromSearchByPatientDemo,
} from "@metriport/commonwell-sdk/lib/common/util";
import * as fs from "fs";
import { nanoid } from "nanoid";
import { docPatient, docPerson, metriportSystem } from "./payloads";

// Document Consumption
// https://commonwellalliance.sharepoint.com/sites/ServiceAdopter/SitePages/Document-Consumption-(SOAP,-REST).aspx

// TODO Remove logs with the prefix '...'

export async function documentConsumption(commonWell: CommonWell, queryMeta: RequestMetadata) {
  const documents = await queryDocuments(commonWell, queryMeta);
  for (const doc of documents) {
    await retrieveDocument(commonWell, queryMeta, doc);
  }
}

export async function queryDocuments(
  commonWell: CommonWell,
  queryMeta: RequestMetadata
): Promise<Document[]> {
  // E1: Document Query
  console.log(`>>> E1c: Query for documents using FHIR (REST)`);

  const respPatient = await commonWell.searchPatient(
    queryMeta,
    docPerson.details.name[0].given[0],
    docPerson.details.name[0].family[0],
    docPerson.details.birthDate,
    docPerson.details.gender.code,
    docPerson.details.address[0].zip
  );
  console.log(respPatient);

  let personId: string | undefined = undefined;
  let patientId: string | undefined = undefined;

  // IF THERE'S A PATIENT, USE IT IT
  if (respPatient._embedded?.patient?.length > 0) {
    const embeddedPatients = respPatient._embedded.patient;
    if (embeddedPatients.length > 1) {
      console.log(`Found more than one patient, using the first one`);
    } else {
      console.log(`Found a patient, using it`);
    }
    const patient = embeddedPatients[0];
    patientId = getIdTrailingSlash(patient);

    const respPerson = await commonWell.searchPersonByPatientDemo(queryMeta, patientId);
    console.log(respPerson);
    personId = getPersonIdFromSearchByPatientDemo(respPerson);

    //
  } else {
    // OTHERWISE ADD ONE
    const respPerson = await commonWell.enrollPerson(queryMeta, docPerson);
    console.log(respPerson);
    personId = getId(respPerson);

    const respPatientCreate = await commonWell.registerPatient(queryMeta, docPatient);
    console.log(respPatientCreate);
    patientId = getIdTrailingSlash(respPatientCreate);
    const patientStrongIds = getPatientStrongIds(respPatientCreate);
    const patientStrongId = patientStrongIds
      ? patientStrongIds.find(id => id.system === metriportSystem)
      : undefined;

    const patientLink = respPatientCreate._links.self.href;
    const respLink = await commonWell.patientLink(
      queryMeta,
      personId,
      patientLink,
      patientStrongId
    );
    console.log(respLink);
  }

  if (!personId) throw new Error(`[E1c] personId is undefined before calling getPatientsLinks()`);
  const respLinks = await commonWell.getPatientsLinks(queryMeta, patientId);
  console.log(respLinks);
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

  console.log(`>>> [E1c] Querying for docs...`);
  const respDocQuery = await commonWell.queryDocuments(queryMeta, patientId);

  return respDocQuery.entry;
}

export async function retrieveDocument(
  commonWell: CommonWell,
  queryMeta: RequestMetadata,
  doc: Document
): Promise<void> {
  // E2: Document Retrieve
  console.log(`>>> E2c: Retrieve documents using FHIR (REST)`);

  const fileName = `./commonwell_${nanoid()}.file`;
  const outputStream = fs.createWriteStream(fileName, {
    // the default is UTF-8, avoid changing the encoding if we don't know the file we're downloading
    encoding: null,
  });
  console.log(`File being created at ${process.cwd()}/${fileName}`);
  const url = doc.content.location;
  await commonWell.retrieveDocument(queryMeta, url, outputStream);
}

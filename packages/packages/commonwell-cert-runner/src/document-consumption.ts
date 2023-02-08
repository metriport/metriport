#!/usr/bin/env node
import { CommonWell, Document, isLOLA1, RequestMetadata } from "@metriport/commonwell-sdk";
import * as fs from "fs";
import { nanoid } from "nanoid";
import { docPerson } from "./payloads";
import { findOrCreatePerson } from "./shared-person";

// Document Consumption
// https://commonwellalliance.sharepoint.com/sites/ServiceAdopter/SitePages/Document-Consumption-(SOAP,-REST).aspx

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

  const { personId, patientId } = await findOrCreatePerson(commonWell, queryMeta, docPerson);

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

  fs.writeFileSync(fileName + ".response", JSON.stringify(doc, undefined, 2));

  const outputStream = fs.createWriteStream(fileName, {
    // the default is UTF-8, avoid changing the encoding if we don't know the file we're downloading
    encoding: null,
  });
  console.log(`File being created at ${process.cwd()}/${fileName}`);
  const url = doc.content.location;
  await commonWell.retrieveDocument(queryMeta, url, outputStream);
}

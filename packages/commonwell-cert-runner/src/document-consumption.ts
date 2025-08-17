#!/usr/bin/env node
import { CommonWell, Document, isLOLA1, RequestMetadata } from "@metriport/commonwell-sdk";
import * as fs from "fs";
import { makeDocPerson, makeId } from "./payloads";
import { findOrCreatePerson } from "./shared-person";
import { filterTruthy } from "./util";

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

  const { personId, patientId } = await findOrCreatePerson(
    commonWell,
    queryMeta,
    makeDocPerson({ facilityId: commonWell.oid })
  );

  if (!personId) throw new Error(`[E1c] personId is undefined before calling getNetworkLinks()`);
  const respLinks = await commonWell.getNetworkLinks(queryMeta, patientId);
  console.log(respLinks);
  const allLinks = respLinks._embedded.networkLink
    ? respLinks._embedded.networkLink.flatMap(filterTruthy)
    : [];
  const lola1Links = allLinks.filter(isLOLA1);
  console.log(`Found ${allLinks.length} network links, ${lola1Links.length} are LOLA 1`);
  for (const link of lola1Links) {
    const upgradeURL = link._links?.upgrade?.href;
    if (!upgradeURL) {
      console.log(`[queryDocuments] missing upgrade URL for link `, link);
      continue;
    }
    const respUpgradeLink = await commonWell.upgradeOrDowngradeNetworkLink(queryMeta, upgradeURL);
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

  // store the query result as well
  const queryFileName = `./cw_consumption_${doc.id ?? "ID"}_${makeId()}.response.file`;
  fs.writeFileSync(queryFileName, JSON.stringify(doc));

  const fileName = `./cw_consumption_${doc.id ?? "ID"}_${makeId()}.contents.file`;
  // the default is UTF-8, avoid changing the encoding if we don't know the file we're downloading
  const outputStream = fs.createWriteStream(fileName, { encoding: undefined });
  console.log(`File being created at ${process.cwd()}/${fileName}`);
  const url = doc.content.location;
  if (!url) throw new Error(`[E2c] missing content.location in document ${doc.id}`);
  await commonWell.retrieveDocument(queryMeta, url, outputStream);
}

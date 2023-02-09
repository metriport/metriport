#!/usr/bin/env node
import {
  CommonWell,
  getIdTrailingSlash,
  isLOLA1,
  RequestMetadata,
} from "@metriport/commonwell-sdk";
import { cloneDeep } from "lodash";
import { docPerson } from "./payloads";
import { findOrCreatePerson } from "./shared-person";
import { getEnv, getEnvOrFail } from "./util";

// Document Contribution
// https://commonwellalliance.sharepoint.com/sites/ServiceAdopter/SitePages/Document-Contribution-(SOAP,-REST).aspx

const orgId = getEnvOrFail("COMMONWELL_SANDBOX_OID");
const orgName = getEnvOrFail("COMMONWELL_SANDBOX_ORG_NAME");
const existingSandboxPatientId = getEnv("DOCUMENT_CONTRIBUTION_PATIENT_ID");

export async function documentContribution(
  commonWell: CommonWell,
  commonwellDocSandbox: CommonWell,
  queryMeta: RequestMetadata
) {
  console.log(`>>> E3: Query for documents served by Metriport's FHIR server`);

  const { personId } = await findOrCreatePerson(commonWell, queryMeta, docPerson);
  console.log(`personId: ${personId}`);

  let sandboxPatientId: string | undefined = undefined;
  let sandboxReferenceLink: string | undefined = undefined;
  try {
    if (existingSandboxPatientId) {
      console.log(`Get patient ${existingSandboxPatientId}...`);
      const respPatient = await commonwellDocSandbox.getPatient(
        queryMeta,
        existingSandboxPatientId
      );
      console.log(respPatient);
      sandboxPatientId = getIdTrailingSlash(respPatient);
      sandboxReferenceLink = respPatient._links.self.href;
    } else {
      console.log(`Register a new patient...`);
      const payloadSandboxPatient = cloneDeep(docPerson);
      payloadSandboxPatient.identifier[0].system = `urn:oid:${orgId}`;
      payloadSandboxPatient.identifier[0].assigner = orgName;
      payloadSandboxPatient.identifier[0].label = orgName;
      const respNewPatient = await commonwellDocSandbox.registerPatient(
        queryMeta,
        payloadSandboxPatient
      );
      console.log(respNewPatient);
      sandboxPatientId = getIdTrailingSlash(respNewPatient);
      sandboxReferenceLink = respNewPatient._links.self.href;

      console.log(`Link patient to person`);
      const respLink = await commonwellDocSandbox.patientLink(
        queryMeta,
        personId,
        sandboxReferenceLink
      );
      console.log(respLink);
    }
    console.log(`patientId: ${sandboxPatientId}`);

    console.log(`Get patients links`);
    const respGetLinks = await commonwellDocSandbox.getPatientsLinks(queryMeta, sandboxPatientId);
    console.log(respGetLinks);

    const allLinks = respGetLinks._embedded.networkLink;
    const lola1Links = allLinks.filter(isLOLA1);
    console.log(`Found ${allLinks.length} network links, ${lola1Links.length} are LOLA 1`);
    for (const link of lola1Links) {
      const respUpgradeLink = await commonwellDocSandbox.upgradeOrDowngradePatientLink(
        queryMeta,
        link._links.upgrade.href
      );
      console.log(respUpgradeLink);
    }

    console.log(`>>> [E3] Querying for docs...`);
    const respDocQuery = await commonwellDocSandbox.queryDocuments(queryMeta, sandboxPatientId);
    console.log(respDocQuery);
    const entries = respDocQuery.entry ?? [];
    for (const entry of entries) {
      console.log(`DOCUMENT: ${JSON.stringify(entry, undefined, 2)}`);
    }

    //
  } finally {
    if (existingSandboxPatientId) {
      console.log(`Not deleting existing patient from sandbox`);
    } else {
      if (sandboxPatientId) {
        console.log(`Deleting patient from sandbox...`);
        await commonwellDocSandbox.deletePatient(queryMeta, sandboxPatientId);
      }
    }
  }
}

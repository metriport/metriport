#!/usr/bin/env node
import {
  CommonWell,
  getIdTrailingSlash,
  isLOLA1,
  RequestMetadata,
} from "@metriport/commonwell-sdk";
import { cloneDeep } from "lodash";
import { docPerson, documentOrgName, documentOrgOID } from "./payloads";
import { findOrCreatePerson } from "./shared-person";

// Document Contribution
// https://commonwellalliance.sharepoint.com/sites/ServiceAdopter/SitePages/Document-Contribution-(SOAP,-REST).aspx

export async function documentContribution(
  commonWell: CommonWell,
  commonwellDocSandbox: CommonWell,
  queryMeta: RequestMetadata
) {
  const { personId } = await findOrCreatePerson(commonWell, queryMeta, docPerson);
  console.log(`... personId: ${personId}`);

  const payloadSandboxPatient = cloneDeep(docPerson);
  payloadSandboxPatient.identifier[0].system = `urn:oid:${documentOrgOID}`;
  payloadSandboxPatient.identifier[0].assigner = documentOrgName;
  payloadSandboxPatient.identifier[0].label = documentOrgName;
  console.log(
    `payloadSandboxPatient.identifier[0].system: ${payloadSandboxPatient.identifier[0].system}\n` +
      `payloadSandboxPatient.identifier[0].assigner: ${payloadSandboxPatient.identifier[0].assigner}`
  );
  const respNewPatient = await commonwellDocSandbox.registerPatient(
    queryMeta,
    payloadSandboxPatient
  );
  console.log(respNewPatient);

  let sandboxPatientId: string | undefined = undefined;
  try {
    sandboxPatientId = getIdTrailingSlash(respNewPatient);
    const sandboxReferenceLink = respNewPatient._links.self.href;
    console.log(`... patientId: ${sandboxPatientId}`);

    const respLink = await commonwellDocSandbox.patientLink(
      queryMeta,
      personId,
      sandboxReferenceLink
    );
    console.log(respLink);

    // const respSearchPerson = await commonWell.searchPersonByPatientDemo(queryMeta, patientId);
    // console.log(respSearchPerson);

    const respGetLinks = await commonwellDocSandbox.getPatientsLinks(queryMeta, sandboxPatientId);
    console.log(respGetLinks);

    // D6: Upgrade/Downgrade a Network link
    console.log(`... Upgrade link from LOLA 1 to LOLA 2`);
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

    console.log(`... Querying for docs...`);
    const respDocQuery = await commonwellDocSandbox.queryDocuments(queryMeta, sandboxPatientId);
    console.log(respDocQuery);

    //
  } finally {
    console.log(`... Deleting patient from sandbox...`);
    sandboxPatientId && (await commonwellDocSandbox.deletePatient(queryMeta, sandboxPatientId));
  }
}

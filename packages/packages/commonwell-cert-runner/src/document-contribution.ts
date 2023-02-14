#!/usr/bin/env node
import {
  APIMode,
  CommonWell,
  getIdTrailingSlash,
  isLOLA1,
  RequestMetadata,
} from "@metriport/commonwell-sdk";

import { cloneDeep } from "lodash";
import { certificate, docPerson, organization } from "./payloads";
import { findOrCreatePerson } from "./shared-person";
import { getEnv, getEnvOrFail } from "./util";

// Document Contribution
// https://commonwellalliance.sharepoint.com/sites/ServiceAdopter/SitePages/Document-Contribution-(SOAP,-REST).aspx

const commonwellPrivateKey = getEnvOrFail("COMMONWELL_PRIVATE_KEY");
const commonwellCert = getEnvOrFail("COMMONWELL_CERTIFICATE");

const orgIdSuffix = getEnvOrFail("DOCUMENT_CONTRIBUTION_ORGANIZATION_ID");

const existingPatientId = getEnv("DOCUMENT_CONTRIBUTION_PATIENT_ID");

const firstName = getEnvOrFail("DOCUMENT_CONTRIBUTION_PATIENT_FIRST_NAME");
const lastName = getEnvOrFail("DOCUMENT_CONTRIBUTION_PATIENT_LAST_NAME");
const dob = getEnvOrFail("DOCUMENT_CONTRIBUTION_PATIENT_DATE_OF_BIRTH");
const gender = getEnvOrFail("DOCUMENT_CONTRIBUTION_PATIENT_GENDER");
const zip = getEnvOrFail("DOCUMENT_CONTRIBUTION_PATIENT_ZIP");

export async function documentContribution({
  memberManagementApi,
  api,
  queryMeta,
}: {
  memberManagementApi: CommonWell;
  api: CommonWell;
  queryMeta: RequestMetadata;
}) {
  console.log(`>>> E3: Query for documents served by Metriport's FHIR server`);

  const {
    orgAPI: apiNewOrg,
    orgId: newOrgId,
    orgName,
  } = await getOrCreateOrg(memberManagementApi, queryMeta);

  const person = docPerson({
    firstName,
    lastName,
    zip,
    gender,
    dob,
  });

  console.log(`Find or create patient and person on main org`);
  const { personId, patientId: patientIdMainOrg } = await findOrCreatePerson(
    api,
    queryMeta,
    person
  );
  console.log(`personId: ${personId}`);
  console.log(`patientId on main org: ${patientIdMainOrg}`);

  let patientIdNewOrg: string | undefined = undefined;
  let referenceLinkNewOrg: string | undefined = undefined;
  try {
    if (existingPatientId) {
      console.log(`Get patient ${existingPatientId}...`);
      const respPatient = await apiNewOrg.getPatient(queryMeta, existingPatientId);
      console.log(respPatient);
      patientIdNewOrg = getIdTrailingSlash(respPatient);
      referenceLinkNewOrg = respPatient._links.self.href;
    } else {
      console.log(`Register a new patient...`);
      const payloadPatientNewOrg = cloneDeep(person);
      payloadPatientNewOrg.identifier[0].system = newOrgId;
      payloadPatientNewOrg.identifier[0].assigner = orgName;
      payloadPatientNewOrg.identifier[0].label = orgName;
      const respNewPatient = await apiNewOrg.registerPatient(queryMeta, payloadPatientNewOrg);
      console.log(respNewPatient);
      patientIdNewOrg = getIdTrailingSlash(respNewPatient);
      referenceLinkNewOrg = respNewPatient._links.self.href;

      console.log(`Link patient to person`);
      const respLink = await apiNewOrg.patientLink(queryMeta, personId, referenceLinkNewOrg);
      console.log(respLink);
    }
    console.log(`patientId: ${patientIdNewOrg}`);

    console.log(`Get patients links`);
    const respGetLinks = await apiNewOrg.getPatientsLinks(queryMeta, patientIdNewOrg);
    console.log(respGetLinks);

    const allLinks = respGetLinks._embedded.networkLink;
    const lola1Links = allLinks.filter(isLOLA1);
    console.log(`Found ${allLinks.length} network links, ${lola1Links.length} are LOLA 1`);
    for (const link of lola1Links) {
      const respUpgradeLink = await apiNewOrg.upgradeOrDowngradePatientLink(
        queryMeta,
        link._links.upgrade.href
      );
      console.log(respUpgradeLink);
    }

    console.log(`>>> [E3] Querying for docs from the main org...`);
    const respDocQuery = await api.queryDocuments(queryMeta, patientIdMainOrg);
    console.log(respDocQuery);
    const entries = respDocQuery.entry ?? [];
    for (const entry of entries) {
      console.log(`DOCUMENT: ${JSON.stringify(entry, undefined, 2)}`);
    }

    //
  } finally {
    if (existingPatientId) {
      console.log(`Not deleting existing patient from sandbox`);
    } else {
      if (patientIdNewOrg) {
        console.log(`Deleting patient from sandbox...`);
        await apiNewOrg.deletePatient(queryMeta, patientIdNewOrg);
      }
    }
  }
}

async function getOrCreateOrg(
  memberManagementApi: CommonWell,
  queryMeta: RequestMetadata
): Promise<{ orgAPI: CommonWell; orgId: string; orgName: string }> {
  const orgPayload = organization(orgIdSuffix);
  const orgId = orgPayload.organizationId;
  const orgIdWithoutNamespace = orgId.slice("urn:oid:".length);
  const orgName = orgPayload.name;
  console.log(`Get the doc org - ID ${orgId}, name ${orgName}`);
  const respGetOneOrg = await memberManagementApi.getOneOrg(queryMeta, orgId);
  console.log(respGetOneOrg);
  if (!respGetOneOrg) {
    console.log(`Doc org not found, create one`);
    const respCreateOrg = await memberManagementApi.createOrg(queryMeta, orgPayload);
    console.log(respCreateOrg);
    console.log(`Add certificate to doc org`);
    const respAddCertificateToOrg = await memberManagementApi.addCertificateToOrg(
      queryMeta,
      certificate,
      orgIdWithoutNamespace
    );
    console.log(respAddCertificateToOrg);
  }

  const orgAPI = new CommonWell(
    commonwellCert,
    commonwellPrivateKey,
    orgName, //commonwellSandboxOrgName,
    orgIdWithoutNamespace, //commonwellSandboxOID,
    APIMode.integration
  );

  return { orgAPI, orgId, orgName };
}

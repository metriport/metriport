#!/usr/bin/env node
import { APIMode, CommonWell, isLOLA1, RequestMetadata } from "@metriport/commonwell-sdk";
import { cloneDeep } from "lodash";

import { certificate, makeDocPerson, makeOrganization, makePatient } from "./payloads";
import { findOrCreatePatient, findOrCreatePerson } from "./shared-person";
import { getEnv, getEnvOrFail } from "./util";

// Document Contribution
// https://commonwellalliance.sharepoint.com/sites/ServiceAdopter/SitePages/Document-Contribution-(SOAP,-REST).aspx

const commonwellPrivateKey = getEnvOrFail("COMMONWELL_PRIVATE_KEY");
const commonwellCert = getEnvOrFail("COMMONWELL_CERTIFICATE");

const orgIdSuffix = getEnvOrFail("DOCUMENT_CONTRIBUTION_ORGANIZATION_ID");

const firstName = getEnv("DOCUMENT_CONTRIBUTION_PATIENT_FIRST_NAME");
const lastName = getEnv("DOCUMENT_CONTRIBUTION_PATIENT_LAST_NAME");
const dob = getEnv("DOCUMENT_CONTRIBUTION_PATIENT_DATE_OF_BIRTH");
const gender = getEnv("DOCUMENT_CONTRIBUTION_PATIENT_GENDER");
const zip = getEnv("DOCUMENT_CONTRIBUTION_PATIENT_ZIP");

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

  const { orgAPI: apiNewOrg, orgName } = await getOrCreateOrg(memberManagementApi, queryMeta);

  const person = makeDocPerson({
    firstName,
    lastName,
    zip,
    gender,
    dob,
    facilityId: api.oid,
  });

  console.log(`Find or create patient and person on main org`);
  const { personId, patientId: patientIdMainOrg } = await findOrCreatePerson(
    api,
    queryMeta,
    person
  );
  console.log(`personId: ${personId}`);
  console.log(`patientId on main org: ${patientIdMainOrg}`);

  const newPerson = cloneDeep(person);
  newPerson.identifier = makePatient({ facilityId: apiNewOrg.oid }).identifier;
  newPerson.identifier[0].assigner = orgName;
  newPerson.identifier[0].label = orgName;
  const { patientId: patientIdNewOrg } = await findOrCreatePatient(
    apiNewOrg,
    queryMeta,
    newPerson,
    personId
  );
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
}

async function getOrCreateOrg(
  memberManagementApi: CommonWell,
  queryMeta: RequestMetadata
): Promise<{ orgAPI: CommonWell; orgName: string }> {
  const orgPayload = makeOrganization(orgIdSuffix);
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

  return { orgAPI, orgName };
}

#!/usr/bin/env node
import { CommonWell, Organization, RequestMetadata, Certificate } from "@metriport/commonwell-sdk";
import stringify from "json-stringify-safe";
import { makeOrganization, orgCertificate, orgCertificateFingerprint } from "./payloads";

// 4. Org Management
// https://commonwellalliance.sharepoint.com/sites/CommonWellServicesPlatform/SitePages/Organization-APIs.aspx

export async function orgManagement(
  commonWell: CommonWell,
  queryMeta: RequestMetadata
): Promise<Organization> {
  // TODO REVERT THIS
  // TODO REVERT THIS
  // TODO REVERT THIS
  // TODO REVERT THIS
  // TODO REVERT THIS
  const orgId = "2.16.840.1.113883.3.9621.5.556874";
  // console.log(`>>> Create an org`);
  // const org = makeOrganization();
  // console.log(`Request payload: ${JSON.stringify(org, null, 2)}`);
  // const respCreateOrg = await commonWell.createOrg(queryMeta, org);
  // console.log(">>> Response: " + JSON.stringify(respCreateOrg, null, 2));

  // console.log(`>>> Update an org`);
  // org.locations[0].city = "Miami";
  // const orgId = respCreateOrg.organizationId;
  // if (!orgId) throw new Error("No orgId on response from createOrg");
  // const respUpdateOrg = await commonWell.updateOrg(queryMeta, org, orgId);
  // console.log(">>> Response: " + JSON.stringify(respUpdateOrg, null, 2));

  // console.log(`>>> Get all orgs`);
  // const respGetAllOrgs = await commonWell.getAllOrgs(queryMeta);
  // console.log(">>> Response: " + JSON.stringify(respGetAllOrgs, null, 2));

  console.log(`>>> Get one org`);
  const respGetOneOrg = await commonWell.getOneOrg(queryMeta, orgId);
  console.log(">>> Response: " + JSON.stringify(respGetOneOrg, null, 2));
  if (!respGetOneOrg) throw new Error("No org on response from getOneOrg");

  // console.log(`>>> Get certificates from org (to see if we need to create new ones)`);
  // let certificates: Certificate[] = [];
  // try {
  //   const { certificates: resp } = await commonWell.getCertificatesFromOrg(queryMeta, orgId);
  //   certificates = resp;
  // } catch (error) {
  //   certificates = [];
  // }
  // if (certificates.length < 1) {
  //   console.log(`>>> Add certificate to org`);
  //   const respAddCertificateToOrg = await commonWell.addCertificateToOrg(
  //     queryMeta,
  //     orgCertificate,
  //     orgId
  //   );
  //   console.log("Response: " + JSON.stringify(respAddCertificateToOrg, null, 2));
  // }
  // console.log(`>>> Replace certificate for org`);
  // const respReplaceCertificateForOrg = await commonWell.replaceCertificateForOrg(
  //   queryMeta,
  //   orgCertificate,
  //   orgId
  // );
  // console.log("Response: " + JSON.stringify(respReplaceCertificateForOrg, null, 2));

  // console.log(`>>> Get certificates from org`);
  // const respGetCertificatesFromOrg = await commonWell.getCertificatesFromOrg(queryMeta, orgId);
  // console.log("Response: " + JSON.stringify(respGetCertificatesFromOrg, null, 2));

  // console.log(`>>> Get certificate from org (by thumbprint)`);
  // const respGetCertificatesFromOrgByThumbprint =
  //   await commonWell.getCertificatesFromOrgByThumbprint(
  //     queryMeta,
  //     orgId,
  //     orgCertificateFingerprint
  //   );
  // console.log("Response: " + JSON.stringify(respGetCertificatesFromOrgByThumbprint, null, 2));

  // console.log(`>>> Get certificate from org (by thumbprint & purpose)`);
  // const respGetCertFromOrgByThumbprintAndPurpose =
  //   await commonWell.getCertificatesFromOrgByThumbprintAndPurpose(
  //     queryMeta,
  //     orgId,
  //     orgCertificateFingerprint,
  //     orgCertificate.Certificates[0].purpose
  //   );
  // console.log("Response: " + JSON.stringify(respGetCertFromOrgByThumbprintAndPurpose, null, 2));

  // console.log(`>>> Delete certificate from org (${orgCertificate.Certificates[0].purpose})`);
  // const respDeleteCertificateFromOrg = await commonWell.deleteCertificateFromOrg(
  //   queryMeta,
  //   orgId,
  //   orgCertificateFingerprint,
  //   orgCertificate.Certificates[0].purpose
  // );
  // console.log("Response: " + respDeleteCertificateFromOrg);

  // console.log(`>>> Delete certificate from org (${orgCertificate.Certificates[1].purpose})`);
  // const respDeleteCertificateFromOrg2 = await commonWell.deleteCertificateFromOrg(
  //   queryMeta,
  //   orgId,
  //   orgCertificateFingerprint,
  //   orgCertificate.Certificates[1].purpose
  // );
  // console.log("Response: " + respDeleteCertificateFromOrg2);

  // console.log(`>>> Add certificate to org again, for patient management`);
  // const respReAddCertificateToOrg = await commonWell.addCertificateToOrg(
  //   queryMeta,
  //   orgCertificate,
  //   orgId
  // );
  // console.log("Response: " + JSON.stringify(respReAddCertificateToOrg, null, 2));

  return respGetOneOrg;
}

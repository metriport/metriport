#!/usr/bin/env node
import { CommonWell, getIdTrailingSlash, RequestMetadata } from "@metriport/commonwell-sdk";

import { certificate, makeOrganization, thumbprint } from "./payloads";

// 4. Org Management
// https://commonwellalliance.sharepoint.com/sites/ServiceAdopter/SitePages/Organization-Management-API---Overview-and-Summary.aspx#overview-and-summary

export async function orgManagement(commonWell: CommonWell, queryMeta: RequestMetadata) {
  console.log(`>>> Create an org`);
  const org = makeOrganization();
  const respCreateOrg = await commonWell.createOrg(queryMeta, org);
  console.log(respCreateOrg);

  console.log(`>>> Update an org`);
  org.locations[0].city = "Miami";
  const orgId = getIdTrailingSlash(respCreateOrg);
  if (!orgId) throw new Error("No orgId on response from createOrg");
  const respUpdateOrg = await commonWell.updateOrg(queryMeta, org, orgId);
  console.log(respUpdateOrg);

  console.log(`>>> Get all orgs`);
  const respGetAllOrgs = await commonWell.getAllOrgs(queryMeta);
  console.log(respGetAllOrgs);

  console.log(`>>> Get one org`);
  const respGetOneOrg = await commonWell.getOneOrg(queryMeta, orgId);
  console.log(respGetOneOrg);

  console.log(`>>> Add certificate to org`);
  const respAddCertificateToOrg = await commonWell.addCertificateToOrg(
    queryMeta,
    certificate,
    orgId
  );
  console.log(respAddCertificateToOrg);

  console.log(`>>> Replace certificate for org`);
  const respReplaceCertificateForOrg = await commonWell.replaceCertificateForOrg(
    queryMeta,
    certificate,
    orgId
  );
  console.log(respReplaceCertificateForOrg);

  console.log(`>>> Get certificate from org`);
  const respGetCertificatesFromOrg = await commonWell.getCertificatesFromOrg(queryMeta, orgId);
  console.log(respGetCertificatesFromOrg);

  console.log(`>>> Get certificate from org (by thumprint)`);
  const respGetCertificatesFromOrgByThumbprint =
    await commonWell.getCertificatesFromOrgByThumbprint(queryMeta, orgId, thumbprint);
  console.log(respGetCertificatesFromOrgByThumbprint);

  console.log(`>>> Get certificate from org (by thumprint & purpose)`);
  const respGetCertificatesFromOrgByThumbprintAndPurpose =
    await commonWell.getCertificatesFromOrgByThumbprintAndPurpose(
      queryMeta,
      orgId,
      thumbprint,
      certificate.Certificates[0].purpose
    );
  console.log(respGetCertificatesFromOrgByThumbprintAndPurpose);

  console.log(`>>> Delete certificate from org`);
  await commonWell.deleteCertificateFromOrg(
    queryMeta,
    orgId,
    thumbprint,
    certificate.Certificates[0].purpose
  );
  console.log("Certificate deleted");
}

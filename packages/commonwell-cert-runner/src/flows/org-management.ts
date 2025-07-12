import { faker } from "@faker-js/faker";
import {
  APIMode,
  Certificate,
  CommonWell,
  CommonWellMember,
  Organization,
} from "@metriport/commonwell-sdk";
import { errorToString } from "@metriport/shared";
import { makeNPI } from "@metriport/shared/common/__tests__/npi";
import {
  existingOrgId,
  memberCertificateString,
  memberId,
  memberName,
  memberPrivateKeyString,
  orgCertificateString,
  orgPrivateKeyString,
} from "../env";
import { makeOrganization, orgCertificate, orgCertificateFingerprint } from "../payloads";

export type OrgManagementResponse = {
  commonWell: CommonWell;
};

/**
 * Flow to validate the org management API (item 8.2.2 in the spec).
 *
 * @see https://www.commonwellalliance.org/specification/
 */
export async function orgManagement(): Promise<OrgManagementResponse> {
  const commonWellMember = new CommonWellMember({
    orgCert: memberCertificateString,
    rsaPrivateKey: memberPrivateKeyString,
    memberName: memberName,
    memberId,
    apiMode: APIMode.integration,
  });

  // TODO ENG-200 gotta set Gateway > FHIR and Auth server's info

  try {
    let orgId: string | undefined = existingOrgId;
    if (orgId) {
      const org = await getOneOrg(commonWellMember, orgId);
      return buildResponse(org);
    }

    console.log(`>>> Create an org`);
    const orgToCreate = makeOrganization();
    // console.log(`Request payload: ${JSON.stringify(org, null, 2)}`);
    const respCreateOrg = await commonWellMember.createOrg(orgToCreate);
    console.log(">>> Transaction ID: " + commonWellMember.lastTransactionId);
    console.log(">>> Response: " + JSON.stringify(respCreateOrg, null, 2));
    orgId = respCreateOrg.organizationId;

    console.log(`>>> Get one org`);
    const respGetOneOrg = await commonWellMember.getOneOrg(orgId);
    console.log(">>> Transaction ID: " + commonWellMember.lastTransactionId);
    console.log(">>> Response: " + JSON.stringify(respGetOneOrg, null, 2));
    if (!respGetOneOrg) throw new Error("No org on response from getOneOrg");
    const org = respGetOneOrg;

    console.log(`>>> Get all orgs`);
    const respGetAllOrgs = await commonWellMember.getAllOrgs();
    console.log(">>> Transaction ID: " + commonWellMember.lastTransactionId);
    console.log(">>> Response: count is " + respGetAllOrgs.organizations.length);

    console.log(`>>> Update an org`);
    org.locations[0].city = faker.location.city();
    if (!org.npiType2) org.npiType2 = makeNPI();
    if (!orgId) throw new Error("No orgId on response from createOrg");
    const respUpdateOrg = await commonWellMember.updateOrg(org);
    console.log(">>> Transaction ID: " + commonWellMember.lastTransactionId);
    console.log(">>> Response: " + JSON.stringify(respUpdateOrg, null, 2));

    console.log(`>>> Get certificates from org (to see if we need to create new ones)`);
    let certificates: Certificate[] = [];
    try {
      const { certificates: resp } = await commonWellMember.getCertificatesFromOrg(orgId);
      console.log(">>> Transaction ID: " + commonWellMember.lastTransactionId);
      certificates = resp;
    } catch (error) {
      certificates = [];
    }
    if (certificates.length < 1) {
      console.log(`>>> Add certificate to org`);
      const respAddCertificateToOrg = await commonWellMember.addCertificateToOrg(
        orgCertificate,
        orgId
      );
      console.log("Response: " + JSON.stringify(respAddCertificateToOrg, null, 2));
      console.log(">>> Transaction ID: " + commonWellMember.lastTransactionId);
    }
    console.log(`>>> Replace certificate for org`);
    const respReplaceCertificateForOrg = await commonWellMember.replaceCertificateForOrg(
      orgCertificate,
      orgId
    );
    console.log(">>> Response: " + JSON.stringify(respReplaceCertificateForOrg, null, 2));
    console.log(">>> Transaction ID: " + commonWellMember.lastTransactionId);

    console.log(`>>> Get certificates from org`);
    const respGetCertificatesFromOrg = await commonWellMember.getCertificatesFromOrg(orgId);
    console.log(">>> Response: " + JSON.stringify(respGetCertificatesFromOrg, null, 2));
    console.log(">>> Transaction ID: " + commonWellMember.lastTransactionId);

    console.log(`>>> Get certificate from org (by thumbprint)`);
    const respGetCertificatesFromOrgByThumbprint =
      await commonWellMember.getCertificatesFromOrgByThumbprint(orgId, orgCertificateFingerprint);
    console.log(">>> Response: " + JSON.stringify(respGetCertificatesFromOrgByThumbprint, null, 2));
    console.log(">>> Transaction ID: " + commonWellMember.lastTransactionId);

    console.log(`>>> Get certificate from org (by thumbprint & purpose)`);
    const respGetCertFromOrgByThumbprintAndPurpose =
      await commonWellMember.getCertificatesFromOrgByThumbprintAndPurpose(
        orgId,
        orgCertificateFingerprint,
        orgCertificate.Certificates[0].purpose
      );
    console.log(
      ">>> Response: " + JSON.stringify(respGetCertFromOrgByThumbprintAndPurpose, null, 2)
    );
    console.log(">>> Transaction ID: " + commonWellMember.lastTransactionId);

    console.log(`>>> Delete certificate from org (${orgCertificate.Certificates[0].purpose})`);
    const respDeleteCertificateFromOrg = await commonWellMember.deleteCertificateFromOrg(
      orgId,
      orgCertificateFingerprint,
      orgCertificate.Certificates[0].purpose
    );
    console.log(">>> Response: " + respDeleteCertificateFromOrg);
    console.log(">>> Transaction ID: " + commonWellMember.lastTransactionId);

    console.log(`>>> Delete certificate from org (${orgCertificate.Certificates[1].purpose})`);
    const respDeleteCertificateFromOrg2 = await commonWellMember.deleteCertificateFromOrg(
      orgId,
      orgCertificateFingerprint,
      orgCertificate.Certificates[1].purpose
    );
    console.log(">>> Response: " + respDeleteCertificateFromOrg2);
    console.log(">>> Transaction ID: " + commonWellMember.lastTransactionId);

    console.log(`>>> Add certificate to org again, for patient management`);
    const respReAddCertificateToOrg = await commonWellMember.addCertificateToOrg(
      orgCertificate,
      orgId
    );
    console.log(">>> Response: " + JSON.stringify(respReAddCertificateToOrg, null, 2));
    console.log(">>> Transaction ID: " + commonWellMember.lastTransactionId);

    return buildResponse(org);
  } catch (error) {
    console.log(`Error (txId ${commonWellMember.lastTransactionId}): ${errorToString(error)}`);
    throw error;
  }
}

function buildResponse(org: Organization): OrgManagementResponse {
  if (!org.npiType2) throw new Error("Organization is missing NPI Type 2");
  const commonWell = new CommonWell({
    orgCert: orgCertificateString,
    rsaPrivateKey: orgPrivateKeyString,
    orgName: org.name,
    oid: org.organizationId,
    homeCommunityId: org.homeCommunityId,
    npi: org.npiType2,
    apiMode: APIMode.integration,
  });
  return { commonWell };
}

export async function getOneOrg(
  commonWell: CommonWellMember,
  orgId: string
): Promise<Organization> {
  console.log(`>>> Get one org`);
  const respGetOneOrg = await commonWell.getOneOrg(orgId);
  console.log(">>> Transaction ID: " + commonWell.lastTransactionId);
  // console.log(">>> Response: " + JSON.stringify(respGetOneOrg, null, 2));
  if (!respGetOneOrg) throw new Error("No org on response from getOneOrg");
  return respGetOneOrg;
}

export async function initApiForExistingOrg(): Promise<OrgManagementResponse> {
  const orgId = existingOrgId;
  if (!orgId) {
    throw new Error("No existing orgId found in env, this is required");
  }
  const commonWellMember = new CommonWellMember({
    orgCert: memberCertificateString,
    rsaPrivateKey: memberPrivateKeyString,
    memberName: memberName,
    memberId: memberId,
    apiMode: APIMode.integration,
  });
  const org = await getOneOrg(commonWellMember, orgId);
  return buildResponse(org);
}

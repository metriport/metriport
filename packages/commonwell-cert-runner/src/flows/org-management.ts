import { faker } from "@faker-js/faker";
import {
  APIMode,
  Certificate,
  CommonWell,
  Organization,
  RequestMetadata,
} from "@metriport/commonwell-sdk";
import { PurposeOfUse } from "@metriport/shared";
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
  orgQueryMeta: RequestMetadata;
};

/**
 * Flow to validate the org management API (item 8.2.2 in the spec).
 *
 * @see https://www.commonwellalliance.org/wp-content/uploads/2025/06/Services-Specification-v4.3-Approved-2025.06.03-1.pdf
 */
export async function orgManagement(): Promise<OrgManagementResponse> {
  const queryMetaMember: RequestMetadata = {
    purposeOfUse: PurposeOfUse.TREATMENT,
    role: "ict",
    subjectId: "admin",
  };
  const commonWellMember = new CommonWell(
    memberCertificateString,
    memberPrivateKeyString,
    memberName,
    memberId,
    APIMode.integration
  );

  // TODO ENG-200 address this
  // TODO ENG-200 gotta set Network > Query Initiator
  // TODO ENG-200 gotta set Gateway > FHIR and Auth server's info

  let orgId: string | undefined = existingOrgId;
  if (orgId) {
    const org = await getOneOrg(commonWellMember, queryMetaMember, orgId);
    return buildResponse(org);
  }

  console.log(`>>> Create an org`);
  const orgToCreate = makeOrganization();
  // console.log(`Request payload: ${JSON.stringify(org, null, 2)}`);
  const respCreateOrg = await commonWellMember.createOrg(queryMetaMember, orgToCreate);
  console.log(">>> Transaction ID: " + commonWellMember.lastTransactionId);
  console.log(">>> Response: " + JSON.stringify(respCreateOrg, null, 2));
  orgId = respCreateOrg.organizationId;

  console.log(`>>> Get one org`);
  const respGetOneOrg = await commonWellMember.getOneOrg(queryMetaMember, orgId);
  console.log(">>> Transaction ID: " + commonWellMember.lastTransactionId);
  console.log(">>> Response: " + JSON.stringify(respGetOneOrg, null, 2));
  if (!respGetOneOrg) throw new Error("No org on response from getOneOrg");
  const org = respGetOneOrg;

  console.log(`>>> Get all orgs`);
  const respGetAllOrgs = await commonWellMember.getAllOrgs(queryMetaMember);
  console.log(">>> Transaction ID: " + commonWellMember.lastTransactionId);
  console.log(">>> Response: " + JSON.stringify(respGetAllOrgs, null, 2));

  console.log(`>>> Update an org`);
  org.locations[0].city = faker.location.city();
  if (!orgId) throw new Error("No orgId on response from createOrg");
  const respUpdateOrg = await commonWellMember.updateOrg(queryMetaMember, org, orgId);
  console.log(">>> Transaction ID: " + commonWellMember.lastTransactionId);
  console.log(">>> Response: " + JSON.stringify(respUpdateOrg, null, 2));

  console.log(`>>> Get certificates from org (to see if we need to create new ones)`);
  let certificates: Certificate[] = [];
  try {
    const { certificates: resp } = await commonWellMember.getCertificatesFromOrg(
      queryMetaMember,
      orgId
    );
    console.log(">>> Transaction ID: " + commonWellMember.lastTransactionId);
    certificates = resp;
  } catch (error) {
    certificates = [];
  }
  if (certificates.length < 1) {
    console.log(`>>> Add certificate to org`);
    const respAddCertificateToOrg = await commonWellMember.addCertificateToOrg(
      queryMetaMember,
      orgCertificate,
      orgId
    );
    console.log("Response: " + JSON.stringify(respAddCertificateToOrg, null, 2));
    console.log(">>> Transaction ID: " + commonWellMember.lastTransactionId);
  }
  console.log(`>>> Replace certificate for org`);
  const respReplaceCertificateForOrg = await commonWellMember.replaceCertificateForOrg(
    queryMetaMember,
    orgCertificate,
    orgId
  );
  console.log(">>> Response: " + JSON.stringify(respReplaceCertificateForOrg, null, 2));
  console.log(">>> Transaction ID: " + commonWellMember.lastTransactionId);

  console.log(`>>> Get certificates from org`);
  const respGetCertificatesFromOrg = await commonWellMember.getCertificatesFromOrg(
    queryMetaMember,
    orgId
  );
  console.log(">>> Response: " + JSON.stringify(respGetCertificatesFromOrg, null, 2));
  console.log(">>> Transaction ID: " + commonWellMember.lastTransactionId);

  console.log(`>>> Get certificate from org (by thumbprint)`);
  const respGetCertificatesFromOrgByThumbprint =
    await commonWellMember.getCertificatesFromOrgByThumbprint(
      queryMetaMember,
      orgId,
      orgCertificateFingerprint
    );
  console.log(">>> Response: " + JSON.stringify(respGetCertificatesFromOrgByThumbprint, null, 2));
  console.log(">>> Transaction ID: " + commonWellMember.lastTransactionId);

  console.log(`>>> Get certificate from org (by thumbprint & purpose)`);
  const respGetCertFromOrgByThumbprintAndPurpose =
    await commonWellMember.getCertificatesFromOrgByThumbprintAndPurpose(
      queryMetaMember,
      orgId,
      orgCertificateFingerprint,
      orgCertificate.Certificates[0].purpose
    );
  console.log(">>> Response: " + JSON.stringify(respGetCertFromOrgByThumbprintAndPurpose, null, 2));
  console.log(">>> Transaction ID: " + commonWellMember.lastTransactionId);

  console.log(`>>> Delete certificate from org (${orgCertificate.Certificates[0].purpose})`);
  const respDeleteCertificateFromOrg = await commonWellMember.deleteCertificateFromOrg(
    queryMetaMember,
    orgId,
    orgCertificateFingerprint,
    orgCertificate.Certificates[0].purpose
  );
  console.log(">>> Response: " + respDeleteCertificateFromOrg);
  console.log(">>> Transaction ID: " + commonWellMember.lastTransactionId);

  console.log(`>>> Delete certificate from org (${orgCertificate.Certificates[1].purpose})`);
  const respDeleteCertificateFromOrg2 = await commonWellMember.deleteCertificateFromOrg(
    queryMetaMember,
    orgId,
    orgCertificateFingerprint,
    orgCertificate.Certificates[1].purpose
  );
  console.log(">>> Response: " + respDeleteCertificateFromOrg2);
  console.log(">>> Transaction ID: " + commonWellMember.lastTransactionId);

  console.log(`>>> Add certificate to org again, for patient management`);
  const respReAddCertificateToOrg = await commonWellMember.addCertificateToOrg(
    queryMetaMember,
    orgCertificate,
    orgId
  );
  console.log(">>>ØResponse: " + JSON.stringify(respReAddCertificateToOrg, null, 2));
  console.log(">>> Transaction ID: " + commonWellMember.lastTransactionId);

  return buildResponse(org);
}

function buildResponse(org: Organization): OrgManagementResponse {
  const orgQueryMeta: RequestMetadata = {
    purposeOfUse: PurposeOfUse.TREATMENT,
    role: "ict",
    subjectId: `${org.name} System User`,
  };
  const commonWell = new CommonWell(
    orgCertificateString,
    orgPrivateKeyString,
    org.name,
    org.organizationId,
    APIMode.integration
  );
  return { commonWell, orgQueryMeta };
}

export async function getOneOrg(
  commonWell: CommonWell,
  queryMeta: RequestMetadata,
  orgId: string
): Promise<Organization> {
  console.log(`>>> Get one org`);
  const respGetOneOrg = await commonWell.getOneOrg(queryMeta, orgId);
  console.log(">>> Transaction ID: " + commonWell.lastTransactionId);
  if (!respGetOneOrg) throw new Error("No org on response from getOneOrg");
  return respGetOneOrg;
}

export async function initApiForExistingOrg(): Promise<OrgManagementResponse> {
  const orgId = existingOrgId;
  if (!orgId) {
    throw new Error("No existing orgId found in env, this is required");
  }
  const memberQueryMeta: RequestMetadata = {
    purposeOfUse: PurposeOfUse.TREATMENT,
    role: "ict",
    subjectId: "admin",
  };
  const commonWellMember = new CommonWell(
    memberCertificateString,
    memberPrivateKeyString,
    memberName,
    memberId,
    APIMode.integration
  );
  const org = await getOneOrg(commonWellMember, memberQueryMeta, orgId);
  return buildResponse(org);
}

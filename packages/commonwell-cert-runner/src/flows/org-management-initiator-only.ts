import { faker } from "@faker-js/faker";
import { APIMode, CommonWell, CommonWellMember } from "@metriport/commonwell-sdk";
import { errorToString } from "@metriport/shared";
import { memberCertificateString, memberId, memberName, memberPrivateKeyString } from "../env";
import { makeOrganization } from "../payloads";

export type OrgManagementResponse = {
  commonWell: CommonWell;
};

/**
 * Flow to validate the org management API (item 8.2.2 in the spec).
 *
 * @see https://www.commonwellalliance.org/specification/
 */
export async function orgManagementInitiatorOnly(): Promise<void> {
  const commonWellMember = new CommonWellMember({
    orgCert: memberCertificateString,
    rsaPrivateKey: memberPrivateKeyString,
    memberName: memberName,
    memberId,
    apiMode: APIMode.integration,
  });
  const errors: unknown[] = [];

  console.log(`>>> ---------------------- Initiator Only ----------------------`);
  try {
    console.log(`>>> Create an initiator only org`);
    const initiatorOnlyOrgCreate = makeOrganization();
    initiatorOnlyOrgCreate.gateways = [];
    initiatorOnlyOrgCreate.securityTokenKeyType = "";
    delete initiatorOnlyOrgCreate.authorizationInformation;

    // console.log(`Request payload: ${JSON.stringify(initiatorOnlyOrgCreate, null, 2)}`);
    const respCreateInitiatorOnly = await commonWellMember.createOrg(initiatorOnlyOrgCreate);
    console.log(">>> Transaction ID: " + commonWellMember.lastTransactionId);
    console.log(">>> Response: " + JSON.stringify(respCreateInitiatorOnly, null, 2));
    const initiatorOnlyOrgId = respCreateInitiatorOnly.organizationId;

    console.log(`>>> Get one org: ${initiatorOnlyOrgId}`);
    const respGetInitiatorOnly = await commonWellMember.getOneOrg(initiatorOnlyOrgId);
    console.log(">>> Transaction ID:" + commonWellMember.lastTransactionId);
    console.log(">>> Response: " + JSON.stringify(respGetInitiatorOnly, null, 2));
    if (!respGetInitiatorOnly) throw new Error("No org on response from getOneOrg");
    const initiatorOnlyOrg = respGetInitiatorOnly;

    console.log(`>>> Update an org`);
    initiatorOnlyOrg.locations[0].city = faker.location.city();
    // console.log("Updated payload: " + JSON.stringify(initiatorOnlyOrg, null, 2));

    if ("securityTokenKeyType" in initiatorOnlyOrg) {
      initiatorOnlyOrg.securityTokenKeyType = "";
    }
    if ("authorizationInformation" in initiatorOnlyOrg) {
      delete initiatorOnlyOrg.authorizationInformation;
    }

    const respUpdateInitiatorOnly = await commonWellMember.updateOrg(initiatorOnlyOrg);
    console.log(">>> Transaction ID: " + commonWellMember.lastTransactionId);
    console.log(">>> Response: " + JSON.stringify(respUpdateInitiatorOnly, null, 2));
  } catch (error) {
    console.log(`Error (txId ${commonWellMember.lastTransactionId}): ${errorToString(error)}`);
    errors.push(error);
  }

  if (errors.length > 0) {
    throw new Error(`Failed to run org management initiator only flow: ${errors.join(", ")}`);
  }
}

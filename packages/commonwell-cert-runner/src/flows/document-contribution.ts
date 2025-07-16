#!/usr/bin/env node
import { faker } from "@faker-js/faker";
import {
  AddressUseCodes,
  APIMode,
  CommonWell,
  CommonWellMember,
  GenderCodes,
  NameUseCodes,
  Patient,
} from "@metriport/commonwell-sdk";
import { encodeToCwPatientId } from "@metriport/commonwell-sdk/common/util";
import { errorToString } from "@metriport/shared";
import { uniq } from "lodash";
import {
  memberCertificateString,
  memberId,
  memberName,
  memberPrivateKeyString,
  orgCertificateString,
  orgPrivateKeyString,
} from "../env";
import { makeOrganization, makePatient, orgCertificate } from "../payloads";
import { patientShirleyDouglas } from "../payloads/patient-shirley";
import { getMetriportPatientIdOrFail, logError } from "../util";
import { initContributionHttpServer } from "./contribution/contribution-server";
import { queryDocuments, retrieveDocument } from "./document-consumption";
import { getOneOrg } from "./org-management";

// If empty, a new org will be created.
const oidOfConsumerOrg = "";
const outputFolder = "./downloads-contribution";

/**
 * This flow is used to test the document contribution API.
 *
 * It requires two Organizations:
 * - the contributor Org (received as parameter), represented by a CommonWell client configured to
 *   manage said Org's data/patients;
 * - the consumer Org, with its OID determined by the constant `oidOfConsumerOrg`; if empty, a new
 *   org will be created.
 *
 * The script will create a new patient on each Org, both patients with the same demographics. Then
 * it'll link the patients, and then query the documents from the consumer Org.
 *
 * In order for the contributor Org to answer to CommonWell's CHA broker's requests, this script will
 * also initialize an HTTP server that will be used to implement that part of the document contribution
 * flow - see `initContributionHttpServer`.
 *
 * Note: it requires a proxy server exposing a public address that's configured in the contributor
 * Org's settings at CommonWell.
 *
 * The flow is:
 * 1. Create a patient on the contributor Org.
 * 2. Create a patient on the consumer Org.
 * 3. Link the patients.
 * 4. Consumer Org queries the documents from the contributor Org.
 * 5. CommonWell's CHA broker will reach out to the contributor Org to query documents.
 * 6. The contributor Org will respond with the list of documents.
 * 7. The CHA broker will then forward that to the consumer Org (request from step 4).
 * 8. The consumer Org will retrieve the documents.
 * 9. The CHA broker will then reach out to the contributor Org to request the document's contents.
 * 10. The contributor Org will respond with the document's contents.
 * 11. The CHA broker will then forward that to the consumer Org (request from step 8).
 * 12. The consumer Org will download the document.
 *
 * @param commonWellContributor The CommonWell client configured to the contributor Org.
 */
export async function documentContribution(commonWellContributor: CommonWell) {
  const patientIdsContributorOrg: string[] = [];
  const patientIdsConsumerOrg: string[] = [];
  let commonWellConsumer: CommonWell | undefined;
  try {
    console.log(`>>> CHA 2 Document Contribution --------------------------------`);
    await initContributionHttpServer(commonWellContributor);

    console.log(`>>> CHA 2.1 Create/load the second org`);
    const commonWellMember = new CommonWellMember({
      orgCert: memberCertificateString,
      rsaPrivateKey: memberPrivateKeyString,
      memberName: memberName,
      memberId,
      apiMode: APIMode.integration,
    });

    let orgId: string = oidOfConsumerOrg;
    if (!orgId || orgId.trim().length < 1) {
      console.log(`>>> Consumer Org's OID not provided, creating a new one...`);
      const orgToCreate = makeOrganization();
      const respCreateOrg = await commonWellMember.createOrg(orgToCreate);
      console.log(">>> Transaction ID: " + commonWellMember.lastTransactionId);
      console.log(">>> Response: " + JSON.stringify(respCreateOrg, null, 2));
      orgId = respCreateOrg.organizationId;
      console.log(`>>> Add certificate to org`);
      const respAddCertificateToOrg = await commonWellMember.addCertificateToOrg(
        orgCertificate,
        orgId
      );
      console.log("Response: " + JSON.stringify(respAddCertificateToOrg, null, 2));
      console.log(">>> Transaction ID: " + commonWellMember.lastTransactionId);
    }

    const org = await getOneOrg(commonWellMember, orgId);
    const npi = org.npiType2;
    if (!npi) throw new Error("No NPI found on the second org");
    commonWellConsumer = new CommonWell({
      orgCert: orgCertificateString,
      rsaPrivateKey: orgPrivateKeyString,
      orgName: org.name,
      oid: org.organizationId,
      homeCommunityId: org.homeCommunityId,
      npi,
      apiMode: APIMode.integration,
    });

    const demographics = makeNewDemographics();
    console.log(`>>> 2.0 Demographics: ${JSON.stringify(demographics, null, 2)}`);

    console.log(`>>> CHA 2.2 Create 1st patient on the contributor org`);
    const patientCreateContributorOrg: Patient = makePatient({
      facilityId: commonWellContributor.oid,
      demographics,
    });
    // console.log(`>>> >>>> PAYLOAD: ${JSON.stringify(patientCreateContributorOrg, null, 2)}`);
    const resp_2_1 = await commonWellContributor.createOrUpdatePatient(patientCreateContributorOrg);
    console.log(">>> Transaction ID: " + commonWellContributor.lastTransactionId);
    console.log(">>> 2.1 Response: " + JSON.stringify(resp_2_1, null, 2));
    const firstPatientId = getMetriportPatientIdOrFail(resp_2_1.Patients[0], "createPatient");
    patientIdsContributorOrg.push(firstPatientId);
    const firstPatientIdEncoded = encodeToCwPatientId({
      patientId: firstPatientId,
      assignAuthority: commonWellContributor.oid,
    });

    console.log(`>>> CHA 2.3 Create 2nd patient on the consumer org`);
    const patientCreateConsumerOrg: Patient = makePatient({
      facilityId: commonWellConsumer.oid,
      demographics,
    });
    // console.log(`>>> >>>> PAYLOAD: ${JSON.stringify(patientCreateConsumerOrg, null, 2)}`);
    const resp_2_2 = await commonWellConsumer.createOrUpdatePatient(patientCreateConsumerOrg);
    console.log(">>> Transaction ID: " + commonWellConsumer.lastTransactionId);
    console.log(">>> 2.2 Response: " + JSON.stringify(resp_2_2, null, 2));
    const secondPatientId = getMetriportPatientIdOrFail(resp_2_2.Patients[0], "createPatient");
    patientIdsConsumerOrg.push(secondPatientId);
    const secondPatientIdEncoded = encodeToCwPatientId({
      patientId: secondPatientId,
      assignAuthority: commonWellConsumer.oid,
    });

    await linkPatients(commonWellContributor, firstPatientIdEncoded);

    const documents = await queryDocuments(commonWellConsumer, secondPatientIdEncoded);
    console.log(`>>> Got ${documents.length} documents, downloading...`);
    for (const doc of documents) {
      const docId = doc.masterIdentifier?.value;
      const isDownloadSuccessful = await retrieveDocument(commonWellConsumer, doc, outputFolder);
      console.log(`>>> Transaction ID: ${commonWellConsumer.lastTransactionId}`);
      if (isDownloadSuccessful) {
        console.log(`>>> Download successful for document ${docId}`);
        continue;
      }
      console.log(`>>> Download failed for document ${docId}, trying the next one...`);
    }
    console.log(`>>> Done querying and retrieving documents`);
  } catch (error) {
    console.log(
      `Error (txId contributor org ${commonWellContributor.lastTransactionId}, txId consumer org ${
        commonWellConsumer?.lastTransactionId
      }): ${errorToString(error)}`
    );
    logError(error);
    throw error;
  } finally {
    console.log(`>>> Delete Patients created in this run`);
    await deletePatients(commonWellContributor, patientIdsContributorOrg);
    if (commonWellConsumer) {
      await deletePatients(commonWellConsumer, patientIdsConsumerOrg);
    }
  }
}

async function deletePatients(commonWell: CommonWell, patientIds: string[]) {
  const uniquePatientIds = uniq(patientIds);
  for (const metriportPatientId of uniquePatientIds) {
    try {
      const patientId = encodeToCwPatientId({
        patientId: metriportPatientId,
        assignAuthority: commonWell.oid,
      });
      await commonWell.deletePatient(patientId);
      console.log(`>>> Patient deleted: ${metriportPatientId}`);
    } catch (err) {
      console.log(`>>> Patient NOT deleted: ${metriportPatientId}`);
      // intentionally ignore it
    }
  }
}

async function linkPatients(commonWell: CommonWell, patientId: string) {
  console.log(`>>> Get Probable Links for patient ${patientId}`);
  const resp_2_2_3 = await commonWell.getProbableLinksById(patientId);
  console.log(">>> Transaction ID: " + commonWell.lastTransactionId);
  console.log(`>>> Probable link count: ${resp_2_2_3.Patients?.length}`);
  // Doing this twice because the first time it returns 0 probable links :/
  console.log(`>>> (2nd) Get Probable Links for patient ${patientId}`);
  const resp_2_2_3x = await commonWell.getProbableLinksById(patientId);
  console.log(">>> Transaction ID: " + commonWell.lastTransactionId);
  console.log(`>>> (2nd) Probable link count: ${resp_2_2_3x.Patients?.length}`);

  let idx = 0;
  for (const patient of resp_2_2_3x.Patients ?? []) {
    const urlToLink = patient?.Links?.Link;
    console.log(`>>> Link Patient ${++idx}, url: ${urlToLink}`);
    const resp_2_3_1 = await commonWell.linkPatients(urlToLink);
    console.log(">>> Transaction ID: " + commonWell.lastTransactionId);
    // console.log(">>> Response: " + JSON.stringify(resp_2_3_1, null, 2));
    console.log(">>> Response: " + resp_2_3_1.status);
  }
}

function makeNewDemographics() {
  const demographics = patientShirleyDouglas;
  demographics.name = [
    {
      use: NameUseCodes.official,
      given: [faker.person.firstName()],
      family: [faker.person.lastName()],
    },
  ];
  demographics.birthDate = faker.date.birthdate().toISOString().split("T")[0];
  demographics.gender = GenderCodes.M;
  demographics.address = [
    {
      use: AddressUseCodes.home,
      postalCode: faker.location.zipCode(),
      state: faker.location.state(),
    },
  ];
  return demographics;
}

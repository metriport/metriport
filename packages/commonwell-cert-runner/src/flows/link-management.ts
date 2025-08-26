import { CommonWell, PatientProbableLink } from "@metriport/commonwell-sdk";
import { encodeCwPatientId } from "@metriport/commonwell-sdk/common/util";
import { errorToString } from "@metriport/shared";
import { uniq } from "lodash";
import { makePatient } from "../payloads";
import { patientTracyCrane } from "../payloads/patient-tracy";
import { createProbablePatientSina } from "../payloads/probable-patient-sina";
import { getMetriportPatientIdOrFail, logError } from "../util";

/**
 * This flow is used to test the patient link management API.
 *
 * @param commonWell The CommonWell client configured to the Org that is being tested.
 */
export async function linkManagement(commonWell: CommonWell) {
  const patientIds: string[] = [];
  try {
    console.log(`>>> 2.1 Get Patient Links --------------------------------`);

    console.log(`>>> 2.1.1 Create Patient`);
    const createPatientWithLinks = makePatient({
      facilityId: commonWell.oid,
      demographics: patientTracyCrane,
      // demographics: patientConnieCarin,
      // demographics: patientMaryLopez,
      // demographics: patientRichardEdmundo,
      // demographics: patientRobertLang,
      // demographics: patientShirleyDouglas,
    });
    const resp_2_1_1 = await commonWell.createOrUpdatePatient(createPatientWithLinks);
    console.log(">>> Transaction ID: " + commonWell.lastTransactionId);
    const ptCreateResponse = resp_2_1_1;
    if (!ptCreateResponse) throw new Error("Did not get links from the response");
    const patientWithLinksId = getMetriportPatientIdOrFail(ptCreateResponse, "patientWithLinks");
    patientIds.push(patientWithLinksId);
    const patientWithLinksIdEncoded = encodeCwPatientId({
      patientId: patientWithLinksId,
      assignAuthority: commonWell.oid,
    });

    console.log(`>>> 2.1.2 Get Patient Links - ID ${patientWithLinksId}`);
    const resp_2_1_2 = await commonWell.getPatientLinksByPatientId(patientWithLinksIdEncoded);
    console.log(">>> Transaction ID: " + commonWell.lastTransactionId);
    console.log(`>>> 2.1.2 Response (${resp_2_1_2.Patients?.length}): ` + stringify(resp_2_1_2));

    console.log(`>>> 2.1.2' Get Patient Links - ID ${patientWithLinksId}`);
    const resp_2_1_2x = await commonWell.getPatientLinksByPatientId(patientWithLinksIdEncoded);
    console.log(">>> Transaction ID: " + commonWell.lastTransactionId);
    console.log(`>>> 2.1.2' Response (${resp_2_1_2x.Patients?.length}): ` + stringify(resp_2_1_2x));

    console.log(`>>> 2.2 Get Probable Links --------------------------------`);

    console.log(`>>> 2.2.1 Create Patient w/ probable match demo`);
    const createPatientWithProbableLinks = makePatient({
      facilityId: commonWell.oid,
      demographics: createProbablePatientSina(),
    });
    const resp_2_2_1 = await commonWell.createOrUpdatePatient(createPatientWithProbableLinks);
    console.log(">>> Transaction ID: " + commonWell.lastTransactionId);
    const patientWithProbableLinksId = getMetriportPatientIdOrFail(
      resp_2_2_1,
      "patientWithProbableLinks"
    );
    patientIds.push(patientWithProbableLinksId);
    const patientWithProbableLinksIdEnconded = encodeCwPatientId({
      patientId: patientWithProbableLinksId,
      assignAuthority: commonWell.oid,
    });
    console.log(`>>> 2.2.1 Get Patient - ID ${patientWithProbableLinksId}`);
    const patientWithProbableLinks = await commonWell.getPatient(
      patientWithProbableLinksIdEnconded
    );
    console.log(">>> 2.2.1 Get Patient Response: " + stringify(patientWithProbableLinks));
    if (!patientWithProbableLinks) throw new Error("Did not get a patient from the response");
    console.log(">>> 2.2.1 URLs to manage links: " + stringify(patientWithProbableLinks?.Links));

    console.log(`>>> 2.2.2 Get Patient Links for ID ${patientWithProbableLinksId}`);
    const resp_2_2_2 = await commonWell.getPatientLinksByPatientId(
      patientWithProbableLinksIdEnconded
    );
    console.log(`>>> 2.2.2 Response (${resp_2_2_2.Patients?.length}): ` + stringify(resp_2_2_2));
    const resp_2_2_2x = await commonWell.getPatientLinksByPatientId(
      patientWithProbableLinksIdEnconded
    );
    console.log(`>>> 2.2.2' Response (${resp_2_2_2x.Patients?.length}): ` + stringify(resp_2_2_2x));

    // console.log(`>>> 2.2.3 Get Probable Links for patient ${patientWithProbableLinksId}`);
    // const resp_2_2_3 = await commonWell.getProbableLinksById(patientWithProbableLinksIdEnconded);
    // console.log(">>> Transaction ID: " + commonWell.lastTransactionId);
    // console.log(`>>> 2.2.3 Probable link count: ${resp_2_2_3.Patients?.length}`);
    // // Doing this twice because the first time it returns 0 probable links :/
    // console.log(`>>> 2.2.3' Get Probable Links for patient ${patientWithProbableLinksId}`);
    // const resp_2_2_3x = await commonWell.getProbableLinksById(patientWithProbableLinksIdEnconded);
    // console.log(">>> Transaction ID: " + commonWell.lastTransactionId);
    // console.log(`>>> 2.2.3' Probable link count: ${resp_2_2_3x.Patients?.length}`);
    // console.log(`>>> 2.2.3' Response (${resp_2_2_3x.Patients?.length}): ` + stringify(resp_2_2_3x));

    const probableLinks = await getProbableLinks(commonWell, patientWithProbableLinksId);
    console.log(`>>> 2.2.1 Probable links 1: ${probableLinks.length}`);
    // fs.writeFileSync("probable-links-1.json", JSON.stringify(probableLinks, null, 2));
    if (probableLinks.length === 0) throw new Error("No probable links found");
    const probableLink = probableLinks[0];
    const urlToLinkWithPatient = probableLink?.Links?.Link;
    const urlToUnlinkWithPatient = probableLink?.Links?.Unlink;
    console.log(`>>> URL to link with patient 1: ${urlToLinkWithPatient}`);
    console.log(`>>> URL to unlink with patient 1: ${urlToUnlinkWithPatient}`);
    if (!urlToLinkWithPatient) throw new Error(`>>> The patient has no probable link to use`);

    // Disabled because this variation of the probable endpoint does not return the Link/Reset props of Links
    // console.log(
    //   `>>> 2.2.3 Get Probable Links for demographics of pt ${patientWithProbableLinksId}`
    // );
    // const resp_2_2_3 = await commonWell.getProbableLinksByDemographics({
    //   firstName: createPatientWithProbableLinks.name[0].given[0]!,
    //   lastName: createPatientWithProbableLinks.name[0].family[0]!,
    //   dob: createPatientWithProbableLinks.birthDate!,
    //   gender: createPatientWithProbableLinks.gender!,
    //   zip: createPatientWithProbableLinks.address[0].postalCode!,
    // });
    // console.log(">>> Transaction ID: " + commonWell.lastTransactionId);
    // console.log(`>>> 2.2.3 Probable link count: ${resp_2_2_3.Patients?.length}`);

    console.log(`>>> 2.3 Link Patient --------------------------------`);

    console.log(`>>> 2.3.1 Link Patient1`);
    const resp_2_3_1 = await commonWell.linkPatients(urlToLinkWithPatient);
    console.log(">>> Transaction ID: " + commonWell.lastTransactionId);
    console.log(">>> 2.3.1 Response: " + stringify(resp_2_3_1));

    console.log(`>>> 2.3.3 Get Patient Links for ID ${patientWithProbableLinksId}`);
    const resp_2_3_3 = await commonWell.getPatientLinksByPatientId(
      patientWithProbableLinksIdEnconded
    );
    console.log(`>>> 2.3.3 Response (${resp_2_3_3.Patients?.length}): ` + stringify(resp_2_3_3));

    console.log(`>>> 2.4 Unlink Patient --------------------------------`);

    console.log(`>>> 2.4.1 Unlink Patient1`);
    const resp_2_4_1 = await commonWell.unlinkPatients(urlToUnlinkWithPatient);
    console.log(">>> Transaction ID: " + commonWell.lastTransactionId);
    console.log(">>> 2.4.1 Response: " + stringify(resp_2_4_1));

    // Don't unlink patient 2 so we can check the reset link works (it should unlink it automatically)

    console.log(`>>> 2.4.2 Get Patient Links - ID ${patientWithProbableLinksId}`);
    const resp_2_4_2 = await commonWell.getPatientLinksByPatientId(
      patientWithProbableLinksIdEnconded
    );
    console.log(">>> Transaction ID: " + commonWell.lastTransactionId);
    console.log(`>>> 2.4.2 Response (${resp_2_4_2.Patients?.length}): ` + stringify(resp_2_4_2));

    console.log(`>>> 2.5 Reset Link --------------------------------`);

    const urlToResetPatientLinks = patientWithProbableLinks.Links?.ResetLink;
    if (!urlToResetPatientLinks) {
      const msg = `The patient has no reset link to use!`;
      console.log(`>>> ${msg}`);
      throw new Error(msg);
    }
    console.log(`>>> 2.5.1 Reset Link`);
    const resp_2_5_1 = await commonWell.resetPatientLinks(urlToResetPatientLinks);
    console.log(">>> Transaction ID: " + commonWell.lastTransactionId);
    console.log(">>> 2.5.1 Response: " + stringify(resp_2_5_1));
    console.log(`>>> 2.5.2 Get Patient Links - ID ${patientWithProbableLinksId}`);
    const resp_2_5_2 = await commonWell.getPatientLinksByPatientId(
      patientWithProbableLinksIdEnconded
    );
    console.log(">>> Transaction ID: " + commonWell.lastTransactionId);
    console.log(`>>> 2.5.2 Response (${resp_2_5_2.Patients?.length}): ` + stringify(resp_2_5_2));
  } catch (error) {
    console.log(`Error (txId ${commonWell.lastTransactionId}): ${errorToString(error)}`);
    logError(error);
    throw error;
  } finally {
    console.log(`>>> Delete Patients created in this run`);
    const uniquePatientIds = uniq(patientIds);
    for (const metriportPatientId of uniquePatientIds) {
      try {
        const patientId = encodeCwPatientId({
          patientId: metriportPatientId,
          assignAuthority: commonWell.oid,
        });
        await commonWell.deletePatient(patientId);
        console.log(`>>> Patient deleted: ${metriportPatientId}`);
      } catch (err) {
        console.log(`>>> Patient NOT deleted: ${metriportPatientId}`);
        // intentionally ignore,
      }
    }
  }
}

async function getProbableLinks(
  commonWell: CommonWell,
  patientId: string
): Promise<PatientProbableLink[]> {
  const patientIdEnconded = encodeCwPatientId({
    patientId,
    assignAuthority: commonWell.oid,
  });
  console.log(`>>> 2.2.3 Get Probable Links for patient ${patientId}`);
  const resp_2_2_3 = await commonWell.getProbableLinksById(patientIdEnconded);
  console.log(">>> Transaction ID: " + commonWell.lastTransactionId);
  console.log(`>>> 2.2.3 Probable link count: ${resp_2_2_3.Patients?.length}`);

  // Doing this twice because the first time it returns 0 probable links :/
  console.log(`>>> 2.2.3' Get Probable Links for patient ${patientId}`);
  const resp_2_2_3x = await commonWell.getProbableLinksById(patientIdEnconded);
  console.log(">>> Transaction ID: " + commonWell.lastTransactionId);
  console.log(`>>> 2.2.3' Probable link count: ${resp_2_2_3x.Patients?.length}`);

  return resp_2_2_3x.Patients;
}

function stringify(value: unknown) {
  return JSON.stringify(value, null, 2);
}

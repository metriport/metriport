/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { CommonWell } from "@metriport/commonwell-sdk";
import { encodeToCwPatientId } from "@metriport/commonwell-sdk/common/util";
import { errorToString, sleep } from "@metriport/shared";
import { uniq } from "lodash";
import { makePatient } from "../payloads";
import { patientTracyCrane } from "../payloads/patient-tracy";
import { createProbablePatientSina } from "../payloads/probable-patient-sina";
import { getMetriportPatientIdOrFail } from "../util";

/**
 * This flow is used to test the patient link management API.
 *
 * @param commonWell The CommonWell client.
 * @param queryMeta The query metadata.
 */
export async function linkManagement(commonWell: CommonWell) {
  const patientIds: string[] = [];
  try {
    console.log(`>>> 2.1 Get Patient Links --------------------------------`);

    console.log(`>>> 2.1.1 Create Patient`);
    const patientWithLinks = makePatient({
      facilityId: commonWell.oid,
      demographics: patientTracyCrane,
      // demographics: patientConnieCarin,
      // demographics: patientMaryLopez,
      // demographics: patientRichardEdmundo,
      // demographics: patientRobertLang,
      // demographics: patientShirleyDouglas,
    });
    const resp_2_1_1 = await commonWell.createOrUpdatePatient(patientWithLinks);
    console.log(">>> Transaction ID: " + commonWell.lastTransactionId);
    const patientWithLinksId = getMetriportPatientIdOrFail(
      resp_2_1_1.Patients[0],
      "patientWithLinks"
    );
    patientIds.push(patientWithLinksId);
    const patientWithLinksIdEncoded = encodeToCwPatientId({
      patientId: patientWithLinksId,
      assignAuthority: commonWell.oid,
    });

    // Had to add a delay in order to get links :/
    let delayInSeconds = 5;
    console.log(`waiting ${delayInSeconds} seconds...`);
    await sleep(5 * 1_000);

    // Had to add this try/catch because the API is returning invalid data according to the spec (DOB in non-ISO format and pt's identifier type 'IAL2')
    try {
      console.log(`>>> 2.1.2 Get Patient Links - ID ${patientWithLinksId}`);
      const resp_2_1_2 = await commonWell.getPatientLinksByPatientId(patientWithLinksIdEncoded);
      console.log(">>> Transaction ID: " + commonWell.lastTransactionId);
      console.log(">>> 2.1.2 Response: " + JSON.stringify(resp_2_1_2, null, 2));
    } catch (error) {
      console.log(">>> Transaction ID: " + commonWell.lastTransactionId);
      console.log(`>>> 2.1.2 Got errors: ${errorToString(error)}`);
    }

    console.log(`>>> 2.2 Get Probable Links --------------------------------`);

    console.log(`>>> 2.2.1 Create Patient w/ probable match demo`);
    const patientWithProbableLinks = makePatient({
      facilityId: commonWell.oid,
      demographics: createProbablePatientSina(),
    });
    const resp_2_2_1 = await commonWell.createOrUpdatePatient(patientWithProbableLinks);
    console.log(">>> Transaction ID: " + commonWell.lastTransactionId);
    const patientWithProbableLinksId = getMetriportPatientIdOrFail(
      resp_2_2_1.Patients[0],
      "patientWithLinks"
    );
    patientIds.push(patientWithProbableLinksId);
    const patientWithProbableLinksIdEnconded = encodeToCwPatientId({
      patientId: patientWithProbableLinksId,
      assignAuthority: commonWell.oid,
    });
    const pt = await commonWell.getPatient(patientWithProbableLinksIdEnconded);
    console.log(">>> 2.2.1 Get Patient Response: " + JSON.stringify(pt, null, 2));

    // Had to add a delay in order to get probable links :/
    delayInSeconds = 5;
    console.log(`waiting ${delayInSeconds} seconds...`);
    await sleep(delayInSeconds * 1_000);

    // TODO ENG-200 Waiting on EllKay, the responses of the following endpoints are not deterministic
    try {
      console.log(`>>> 2.2.2 Get Probable Links for patient ${patientWithProbableLinksId}`);
      const resp_2_2_2 = await commonWell.getProbableLinksById(patientWithProbableLinksIdEnconded);
      console.log(">>> Transaction ID: " + commonWell.lastTransactionId);
      // console.log(
      //   `>>> 2.2.2 Response (${resp_2_2_2.Patients?.length}): ` +
      //     JSON.stringify(resp_2_2_2, null, 2)
      // );
      console.log(`>>> 2.2.2 Response (${resp_2_2_2.Patients?.length})`);
    } catch (error) {
      console.log(">>> Transaction ID: " + commonWell.lastTransactionId);
      console.log(`>>> 2.2.2 Got errors: ${errorToString(error)}`);
    }
    try {
      console.log(`>>> 2.2.2' Get Probable Links for patient ${patientWithProbableLinksId}`);
      const resp_2_2_2 = await commonWell.getProbableLinksById(patientWithProbableLinksIdEnconded);
      console.log(">>> Transaction ID: " + commonWell.lastTransactionId);
      console.log(
        `>>> 2.2.2' Response (${resp_2_2_2.Patients?.length}): ` +
          JSON.stringify(resp_2_2_2, null, 2)
      );
      // console.log(`>>> 2.2.2' Response (${resp_2_2_2.Patients?.length})`);
    } catch (error) {
      console.log(">>> Transaction ID: " + commonWell.lastTransactionId);
      console.log(`>>> 2.2.2 Got errors: ${errorToString(error)}`);
    }
    try {
      console.log(
        `>>> 2.2.3 Get Probable Links for demographics of pt ${patientWithProbableLinksId}`
      );
      const resp_2_2_3 = await commonWell.getProbableLinksByDemographics({
        firstName: patientWithProbableLinks.name[0].given[0]!,
        lastName: patientWithProbableLinks.name[0].family[0]!,
        dob: patientWithProbableLinks.birthDate!,
        gender: patientWithProbableLinks.gender!,
        zip: patientWithProbableLinks.address[0].postalCode!,
      });
      console.log(">>> Transaction ID: " + commonWell.lastTransactionId);
      // console.log(
      //   `>>> 2.2.3 Response (${resp_2_2_3.Patients?.length}): ` +
      //     JSON.stringify(resp_2_2_3, null, 2)
      // );
      console.log(`>>> 2.2.3 Response (${resp_2_2_3.Patients?.length})`);
    } catch (error) {
      console.log(">>> Transaction ID: " + commonWell.lastTransactionId);
      console.log(`>>> 2.2.3 Got errors: ${errorToString(error)}`);
    }

    // %%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
    // %%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
    // %%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
    // %%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
    // %%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
    // %%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
    // %%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%

    // console.log(`>>> 2.3 Link Patient --------------------------------`);
    // console.log(`>>> 2.4 Unlink Patient --------------------------------`);
    // console.log(`>>> 2.5 Reset Link --------------------------------`);
  } catch (error) {
    console.log(`Error (txId ${commonWell.lastTransactionId}): ${errorToString(error)}`);
    throw error;
  } finally {
    console.log(`>>> Delete Patients created in this run`);
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
        // intentionally ignore,
      }
    }
  }
}

import { CommonWell, Patient } from "@metriport/commonwell-sdk";
import { encodeToCwPatientId } from "@metriport/commonwell-sdk/common/util";
import { errorToString } from "@metriport/shared";
import { cloneDeep, uniq } from "lodash";
import { makePatient } from "../payloads";
import { patientConnieCarin } from "../payloads/patient-connie";
import { patientTracyCrane } from "../payloads/patient-tracy";
import { getMetriportPatientIdOrFail, makeShortName } from "../util";

/**
 * Flow to validate the patient management API (item 8.3.2 in the spec).
 * @see https://www.commonwellalliance.org/wp-content/uploads/2025/06/Services-Specification-v4.3-Approved-2025.06.03-1.pdf
 *
 * Checklist:
 * - Members should create a minimum of 2 patients - 1 new test patient for your organization and
 *   1 patient from the "Test Org & Test Patients" section.
 * @see https://commonwellalliance.sharepoint.com/sites/CommonWellServicesPlatform/SitePages/Onboarding-Checklist.aspx
 *
 * @param commonWell - CommonWell API client configured with the Organization that "owns" the patient - not the CW member one.
 * @param queryMeta - Request metadata for the CommonWell API client.
 */
export async function patientManagement(commonWell: CommonWell) {
  const patientIds: string[] = [];
  try {
    console.log(`>>> 1.1 Create Patient --------------------------------`);
    const firstPatientCreate: Patient = makePatient({
      facilityId: commonWell.oid,
      demographics: patientTracyCrane,
    });
    // console.log(`>>> >>>> PAYLOAD: ${JSON.stringify(firstPatientCreate, null, 2)}`);
    const resp_1_1 = await commonWell.createOrUpdatePatient(firstPatientCreate);
    console.log(">>> Transaction ID: " + commonWell.lastTransactionId);
    console.log(">>> 1.1 Response: " + JSON.stringify(resp_1_1, null, 2));
    const firstPatientId = getMetriportPatientIdOrFail(resp_1_1.Patients[0], "createPatient");
    patientIds.push(firstPatientId);
    const firstPatientIdEncoded = encodeToCwPatientId({
      patientId: firstPatientId,
      assignAuthority: commonWell.oid,
    });

    console.log(`>>> 1.3 Get Patient - ID ${firstPatientId}`);
    const resp_1_3 = await commonWell.getPatient(firstPatientIdEncoded);
    console.log(">>> Transaction ID: " + commonWell.lastTransactionId);
    console.log(">>> 1.3 Response: " + JSON.stringify(resp_1_3, null, 2));

    const firstPatientGet: Patient | null | undefined = resp_1_3.Patients[0]?.Patient;
    if (!firstPatientGet) throw new Error("No patient on response from getPatient");

    console.log(`>>> 1.2: Update a Patient --------------------------------`);

    console.log(`>>> 1.2.1: Update a Patient`);
    const patientToUpdate = cloneDeep(firstPatientGet);
    const newGivenName = "Anna " + makeShortName();
    patientToUpdate.name[0].given[0] = newGivenName;
    // console.log(`>>> >>>> PAYLOAD: ${JSON.stringify(patientToUpdate, null, 2)}`);
    const resp_1_2_1 = await commonWell.createOrUpdatePatient(patientToUpdate);
    console.log(">>> Transaction ID: " + commonWell.lastTransactionId);
    console.log(">>> 1.2.1 Response: " + JSON.stringify(resp_1_2_1, null, 2));

    console.log(`>>> 1.2.2: Confirm it was updated correctly`);
    const resp_1_2_2 = await commonWell.getPatient(firstPatientIdEncoded);
    console.log(">>> 1.2.2 Response: " + JSON.stringify(resp_1_2_2, null, 2));
    console.log(">>> Transaction ID: " + commonWell.lastTransactionId);
    const patientToUpdateId = getMetriportPatientIdOrFail(
      resp_1_2_2.Patients[0],
      "patientToUpdate"
    );
    patientIds.push(patientToUpdateId);
    const updatedPatient = resp_1_2_2.Patients[0]?.Patient;
    if (!updatedPatient) {
      console.log(`>>> 1.2.2: Couldn't get patient!`);
    } else {
      const updatedPatientName = updatedPatient.name[0].given[0];
      if (updatedPatientName !== newGivenName) {
        console.log(`>>> 1.2.2: Patient name was not updated correctly! :/`);
      } else {
        console.log(`>>> 1.2.2: Patient was updated correctly!`);
      }
    }

    console.log(`>>> 1.4 Merge Patient --------------------------------`);

    console.log(`>>> 1.4.1 Create 2nd Patient`);
    const patientToMerge = makePatient({
      facilityId: commonWell.oid,
      demographics: patientConnieCarin,
    });
    // console.log(`>>> >>>> PAYLOAD: ${JSON.stringify(patientToMerge, null, 2)}`);
    const resp_1_4_1 = await commonWell.createOrUpdatePatient(patientToMerge);
    console.log(">>> Transaction ID: " + commonWell.lastTransactionId);
    console.log(">>> 1.4.1 Response: " + JSON.stringify(resp_1_4_1, null, 2));
    const patientToMergeId = getMetriportPatientIdOrFail(resp_1_4_1.Patients[0], "patientToMerge");
    patientIds.push(patientToMergeId);
    const patientToMergeIdEncoded = encodeToCwPatientId({
      patientId: patientToMergeId,
      assignAuthority: commonWell.oid,
    });

    console.log(`>>> 1.4.2 Merge Patient`);
    const resp_1_4_2 = await commonWell.mergePatients({
      nonSurvivingPatientId: patientToMergeIdEncoded,
      survivingPatientId: firstPatientIdEncoded,
    });
    console.log(">>> Transaction ID: " + commonWell.lastTransactionId);
    console.log(">>> 1.4.2 Response: " + JSON.stringify(resp_1_4_2, null, 2));

    console.log(`>>> 1.4.3: Confirm it was merged correctly`);
    const resp_1_4_3_1 = await commonWell.getPatient(firstPatientIdEncoded);
    console.log(">>> Transaction ID: " + commonWell.lastTransactionId);
    console.log(">>> 1.4.3.1 Response: " + JSON.stringify(resp_1_4_3_1, null, 2));
    const mergedPatient = resp_1_4_3_1.Patients[0]?.Patient;
    let foundNonSurvivingPatient: boolean;
    try {
      const resp_1_4_3_2 = await commonWell.getPatient(patientToMergeIdEncoded);
      console.log(">>> Transaction ID: " + commonWell.lastTransactionId);
      console.log(">>> 1.4.3.2 Response: " + JSON.stringify(resp_1_4_3_2, null, 2));
      foundNonSurvivingPatient = true;
    } catch (error) {
      // intentionally ignore, we expect this to fail
      foundNonSurvivingPatient = false;
    }
    if (!mergedPatient) {
      console.log(`>>> 1.4.3: [Merge] FAILED: Couldn't get patient`);
    } else {
      const mergedPatientName = mergedPatient.name[0].given[0];
      if (mergedPatientName !== newGivenName) {
        console.log(`>>> 1.4.3: [Merge] FAILED: Surviving Patient's name is not what we expected`);
      } else if (foundNonSurvivingPatient) {
        console.log(`>>> 1.4.3: [Merge] FAILED: Non-surviving patient was not deleted`);
      } else {
        console.log(`>>> 1.4.3: [Merge] Patient was merged correctly`);
      }
    }

    console.log(`>>> 1.5 Delete Patient --------------------------------`);

    console.log(`>>> 1.5.1 Create Patient (random demographics)`);
    const patientToDelete = makePatient({ facilityId: commonWell.oid });
    // console.log(`>>> >>>> PAYLOAD: ${JSON.stringify(patientToDelete, null, 2)}`);
    const resp_1_5_1 = await commonWell.createOrUpdatePatient(patientToDelete);
    console.log(">>> Transaction ID: " + commonWell.lastTransactionId);
    console.log(">>> 1.5.1 Response: " + JSON.stringify(resp_1_5_1, null, 2));
    const patientToDeleteId = getMetriportPatientIdOrFail(
      resp_1_5_1.Patients[0],
      "patientToDelete"
    );
    patientIds.push(patientToDeleteId);
    const patientToDeleteIdEncoded = encodeToCwPatientId({
      patientId: patientToDeleteId,
      assignAuthority: commonWell.oid,
    });
    console.log(`>>> 1.5.2 Delete Patient`);
    await commonWell.deletePatient(patientToDeleteIdEncoded);
    console.log(">>> Transaction ID: " + commonWell.lastTransactionId);
    console.log(`>>> 1.5.2 Patient deleted successfully`);
    try {
      await commonWell.getPatient(patientToDeleteIdEncoded);
      console.log(`>>> 1.5 Patient NOT deleted successfully <<<`);
    } catch (err) {
      console.log(`>>> 1.5 Patient delete confirmed`);
      patientIds.splice(patientIds.indexOf(patientToDeleteId), 1);
    }

    // 1.6 Patient Disclosure --------------------------------
    // https://commonwellalliance.sharepoint.com/sites/CommonWellServicesPlatform/SitePages/Onboarding-Checklist.aspx
    // We're not implementing this on the cert runner since we have a process in place for patient opt-out.

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
        // intentionally ignore it
      }
    }
  }
}

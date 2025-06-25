import { CommonWell, RequestMetadata } from "@metriport/commonwell-sdk";
import { encodeToCwPatientId } from "@metriport/commonwell-sdk/common/util";
import { errorToString, sleep } from "@metriport/shared";
import { uniq } from "lodash";
import { makePatient } from "../payloads";
import { patientTracyCrane } from "../payloads/patient-crane";
import { getMetriportPatientIdOrFail } from "../util";

/**
 *
 * @param commonWell
 * @param queryMeta
 */
export async function linkManagement(commonWell: CommonWell, queryMeta: RequestMetadata) {
  const patientIds: string[] = [];
  try {
    console.log(`>>> 2.1 Get Patient Links`);
    console.log(`>>> 2.1.1 Create Patient`);
    const patientWithLinks = makePatient({
      facilityId: commonWell.oid,
      demographics: patientTracyCrane,
    });
    const resp_2_1_1 = await commonWell.createOrUpdatePatient(queryMeta, patientWithLinks);
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

    // Had to add a delay in order to get links
    await sleep(5_000);

    // Had to add this try/catch because the API is returning invalid data according to the spec (DOB in non-ISO format and pt's identifier type 'IAL2')
    try {
      console.log(`>>> 2.1.2 Get Patient Links - ID ${patientWithLinksId}`);
      const resp_2_1_2 = await commonWell.getPatientLinksByPatientId(
        queryMeta,
        patientWithLinksIdEncoded
      );
      console.log(">>> Transaction ID: " + commonWell.lastTransactionId);
      console.log(">>> 2.1.2 Response: " + JSON.stringify(resp_2_1_2, null, 2));
    } catch (error) {
      console.log(">>> Transaction ID: " + commonWell.lastTransactionId);
      console.log(`>>> 2.1.2 Got errors: ${errorToString(error)}`);
    }

    // TODO ENG-200 address this

    // // C5: Levels of Link Assurance
    // console.log(`>>> C5a : Link a Patient to a Person upgrading from LOLA 1 to LOLA 2.`);
    // const person = await commonWell.enrollPerson(queryMeta, personStrongId);
    // const personId = getPersonId(person);
    // if (!personId) throw new Error("No personId on response from enrollPerson");

    // const respPatient = await commonWell.createPatient(
    //   queryMeta,
    //   makePatient({ facilityId: commonWell.oid })
    // );
    // const patientUri = respPatient._links?.self.href;
    // if (!patientUri) throw new Error("No patientUri on response from registerPatient");
    // const patientId = getIdTrailingSlash(respPatient);
    // if (!patientId) throw new Error("No patientId on response from registerPatient");
    // const referenceLink = respPatient._links?.self.href;
    // if (!referenceLink) throw new Error("No referenceLink on response from registerPatient");
    // const respC5a = await commonWell.addPatientLink(queryMeta, personId, referenceLink);
    // console.log(respC5a);
    // const patientLinkUri = respC5a._links?.self?.href;
    // if (!patientLinkUri) throw new Error("No patientLinkUri on response from addPatientLink");

    // console.log(`>>> C5b : Upgrade Patient link from LOLA 2 to LOLA 3 (with Strong ID).`);
    // const respC5b = await commonWell.updatePatientLink(
    //   queryMeta,
    //   patientLinkUri,
    //   patientUri,
    //   identifier
    // );
    // console.log(respC5b);

    // console.log(`>>> C5c : Downgrade Patient link from LOLA 3 to LOLA 2 (without Strong ID).`);
    // const respC5c = await commonWell.updatePatientLink(queryMeta, patientLinkUri, patientUri);
    // console.log(respC5c);
    // const patientLinkFromUpdate = respC5c._links?.self.href;
    // if (!patientLinkFromUpdate)
    //   throw new Error("No patientLinkFromUpdate on response from updatePatientLink");

    // console.log(`>>> C5a : Delete Patient/Person link that exists as LOLA 2.`);
    // await commonWell.deletePatientLink(queryMeta, patientLinkFromUpdate);

    // // Note: will be deleting patient & person created in this run
    // await commonWell.deletePerson(queryMeta, personId);
    // await commonWell.deletePatient(queryMeta, patientId);
  } finally {
    console.log(`>>> Delete Patients created in this run`);
    const uniquePatientIds = uniq(patientIds);
    for (const metriportPatientId of uniquePatientIds) {
      try {
        const patientId = encodeToCwPatientId({
          patientId: metriportPatientId,
          assignAuthority: commonWell.oid,
        });
        await commonWell.deletePatient(queryMeta, patientId);
        console.log(`>>> Patient deleted: ${metriportPatientId}`);
      } catch (err) {
        console.log(`>>> Patient NOT deleted: ${metriportPatientId}`);
        // intentionally ignore,
      }
    }
  }
}

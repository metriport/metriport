import { CommonWell, Document, DocumentStatus, Patient } from "@metriport/commonwell-sdk";
import { encodeToCwPatientId } from "@metriport/commonwell-sdk/common/util";
import { errorToString, sleep } from "@metriport/shared";
import fs from "fs";
import { uniq } from "lodash";
import { makeId, makePatient } from "../payloads";
import { patientTracyCrane } from "../payloads/patient-tracy";
import { getMetriportPatientIdOrFail, logError } from "../util";

/**
 * Flow to validate the document consumption API (item 10.1 and 10.2 in the spec).
 * @see https://www.commonwellalliance.org/wp-content/uploads/2025/06/Services-Specification-v4.3-Approved-2025.06.03-1.pdf
 *
 * Checklist:
 * - You are able to query for external documents on a patient from the Test Patient list.
 * - You are able to retrieve external documents on a patient from the Test Patient list
 * @see https://commonwellalliance.sharepoint.com/sites/CommonWellServicesPlatform/SitePages/Onboarding-Checklist.aspx
 *
 * @param commonWell - CommonWell API client configured with the Organization that "owns" the patient - not the CW member one.
 * @param queryMeta - Request metadata for the CommonWell API client.
 * @param patientId - Patient ID to query documents for.
 */
export async function documentConsumption(commonWell: CommonWell) {
  const patientIds: string[] = [];
  try {
    console.log(`>>> 1 Document Consumer`);

    console.log(`>>> 1.0 Create Patient`);
    const patientCreate: Patient = makePatient({
      facilityId: commonWell.oid,
      demographics: patientTracyCrane,
      // demographics: patientConnieCarin,
      // demographics: patientMaryLopez,
    });
    const resp_1_0 = await commonWell.createOrUpdatePatient(patientCreate);
    console.log(">>> Transaction ID: " + commonWell.lastTransactionId);
    console.log(">>> 1.0 Response: " + JSON.stringify(resp_1_0, null, 2));
    const patientId = getMetriportPatientIdOrFail(resp_1_0.Patients[0], "createPatient");
    patientIds.push(patientId);

    const encodedPatientId = encodeToCwPatientId({
      patientId,
      assignAuthority: commonWell.oid,
    });

    console.log(`>>> Waiting for caches to be updated...`);
    await sleep(5_000);
    console.log(`>>> Done waiting`);

    const documents = await queryDocuments(commonWell, encodedPatientId);
    console.log(`>>> Got ${documents.length} documents`);
    // TODO ENG-200 FINISH THIS
    // for (const doc of documents) {
    //   await retrieveDocument(commonWell, queryMeta, doc);
    // }
  } catch (error) {
    console.log(`Error (txId ${commonWell.lastTransactionId}): ${errorToString(error)}`);
    logError(error);
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

export async function queryDocuments(
  commonWell: CommonWell,
  patientId: string
): Promise<Document[]> {
  console.log(`>>> 1.1 Document Query`);
  async function getByStatus(status: DocumentStatus) {
    console.log(`>>> 1.1.1 Document Query for status: ${status}`);
    const respDocQuery = await commonWell.queryDocuments(patientId, { status });
    console.log(">>> Transaction ID: " + commonWell.lastTransactionId);
    console.log(">>> 1.1.1 Response: " + JSON.stringify(respDocQuery, null, 2));
    const documents = respDocQuery.entry;
    console.log(`>>> 1.1.1 Got ${documents.length} documents`);
    return documents;
  }
  const documentsCurrent = await getByStatus("current");
  const documentsSuperseded = await getByStatus("superseded");
  const documentsEnteredInError = await getByStatus("entered-in-error");
  const documents = [...documentsCurrent, ...documentsSuperseded, ...documentsEnteredInError];
  console.log(`>>> 1.1 Got ${documents.length} documents for all statuses`);
  return documents;
}

// TODO ENG-200 FINISH THIS
export async function retrieveDocument(commonWell: CommonWell, doc: Document): Promise<void> {
  // E2: Document Retrieve
  console.log(`>>> E2c: Retrieve documents using FHIR (REST)`);

  // store the query result as well
  const queryFileName = `./cw_consumption_${doc.id ?? "ID"}_${makeId()}.response.file`;
  fs.writeFileSync(queryFileName, JSON.stringify(doc));

  const fileName = `./cw_consumption_${doc.id ?? "ID"}_${makeId()}.contents.file`;
  // the default is UTF-8, avoid changing the encoding if we don't know the file we're downloading
  const outputStream = fs.createWriteStream(fileName, { encoding: undefined });
  console.log(`File being created at ${process.cwd()}/${fileName}`);
  const url = doc.content.location;
  if (!url) throw new Error(`[E2c] missing content.location in document ${doc.id}`);
  await commonWell.retrieveDocument(url, outputStream);
}

import { CommonWell, DocumentReference, DocumentStatus, Patient } from "@metriport/commonwell-sdk";
import { encodeToCwPatientId } from "@metriport/commonwell-sdk/common/util";
import { errorToString } from "@metriport/shared";
import { buildDayjs } from "@metriport/shared/common/date";
import fs from "fs";
import { uniq } from "lodash";
import { contentType, extension } from "mime-types";
import { nanoid } from "nanoid";
import { makePatient } from "../payloads";
import { patientTracyCrane } from "../payloads/patient-tracy";
import { getMetriportPatientIdOrFail, logError, waitSeconds } from "../util";

const runTimestamp = buildDayjs().toISOString();

const outputBaseDir = "./downloads";
const runTimestamp = buildDayjs().toISOString();

/**
 * Flow to validate the document consumption API (item 10.1 and 10.2 in the spec).
 * @see https://www.commonwellalliance.org/specification/
 *
 * Checklist:
 * - You are able to query for external documents on a patient from the Test Patient list.
 * - You are able to retrieve external documents on a patient from the Test Patient list
 * @see https://commonwellalliance.sharepoint.com/sites/CommonWellServicesPlatform/SitePages/Onboarding-Checklist.aspx
 *
 * @param commonWell - CommonWell API client configured with the Organization that "owns" the patient - not the CW member one.
 * @param queryMeta - Request metadata for the CommonWell API client.
 * @param patientId - Patient ID to query documents for.
 * @param downloadAll - Optional. If true, download all documents. If false, download only the first
 *                      successful document. Default is false.
 */
export async function documentConsumption(commonWell: CommonWell, downloadAll = false) {
  const patientIds: string[] = [];
  try {
    console.log(`>>> CHA 2 Document Consumption --------------------------------`);

    console.log(`>>> 2.0 Create Patient`);
    const patientCreate: Patient = makePatient({
      facilityId: commonWell.oid,
      demographics: patientTracyCrane,
    });
    const resp_1_0 = await commonWell.createOrUpdatePatient(patientCreate);
    console.log(">>> Transaction ID: " + commonWell.lastTransactionId);
    console.log(">>> 2.0 Response: " + JSON.stringify(resp_1_0, null, 2));
    const patientId = getMetriportPatientIdOrFail(resp_1_0.Patients[0], "createPatient");
    patientIds.push(patientId);

    const encodedPatientId = encodeToCwPatientId({
      patientId,
      assignAuthority: commonWell.oid,
    });

    await waitSeconds(5);

    const documents = await queryDocuments(commonWell, encodedPatientId);
    console.log(`>>> Got ${documents.length} documents`);
    for (const doc of documents) {
      const docId = doc.masterIdentifier?.value;
      const isDownloadSuccessful = await retrieveDocument(commonWell, doc);
      console.log(`>>> Transaction ID: ${commonWell.lastTransactionId}`);
      if (isDownloadSuccessful) {
        console.log(`>>> Download successful for document ${docId}`);
        if (downloadAll) continue;
        console.log(`>>> Skipping the remaining documents because downloadAll is false`);
        break;
      }
      console.log(`>>> Download failed for document ${docId}, trying the next one...`);
    }
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
): Promise<DocumentReference[]> {
  console.log(`>>> 1.1 Document Query`);
  async function getByStatus(status: DocumentStatus): Promise<DocumentReference[]> {
    console.log(`>>> 1.1.1 Document Query for status: ${status}`);
    const documents = await commonWell.queryDocuments(patientId, { status });
    console.log(">>> Transaction ID: " + commonWell.lastTransactionId);
    console.log(`>>> 1.1.1 Response (status ${status}): ` + JSON.stringify(documents, null, 2));
    console.log(`>>> 1.1.1 Got ${documents.length} documents for status ${status}`);
    return documents;
  }
  const documents = await getByStatus("current");
  console.log(`>>> 1.1 Got ${documents.length} documents for all statuses`);
  return documents;
}

export async function retrieveDocument(
  commonWell: CommonWell,
  doc: DocumentReference,
  outputBaseDir = "./downloads-consumption"
): Promise<boolean> {
  const id = doc.masterIdentifier?.value ?? doc.id;
  const docId = id ?? "ID-" + nanoid();
  const content = doc.content[0];
  const url = content?.attachment.url;
  if (!url) {
    console.log(`Missing doc ref URL in document ${id}, skipping...`);
    return false;
  }
  const contentType = content?.attachment.contentType ?? "application/octet-stream";
  const fileExtension = getFileExtension(contentType);

  console.log(`>>> 1.2 Document Retrieve`);

  const outputDir = `${outputBaseDir}/${runTimestamp}`;
  fs.mkdirSync(outputDir, { recursive: true });
  const fileNamePrefix = `${outputDir}/${docId}`;
  const docRefFileName = `${fileNamePrefix}.docRef.json`;
  const contentsFileName = `${fileNamePrefix}.contents${fileExtension}`;

  console.log(`>>> DocRef being stored at ${docRefFileName}`);
  fs.writeFileSync(docRefFileName, JSON.stringify(doc, null, 2));
  console.log(`>>> Contents being stored at ${contentsFileName}`);
  const outputStream = fs.createWriteStream(contentsFileName, { encoding: undefined });
  try {
    const { contentType, size } = await commonWell.retrieveDocument(url, outputStream);
    console.log(
      `>>> Downloaded document ${docId}, size: ${size} bytes, contentType: ${contentType}`
    );
    if (contentsFileName.endsWith(".bin")) {
      const newFileExtension = getFileExtension(contentType);
      fs.renameSync(contentsFileName, `${contentsFileName.replace(".bin", "")}${newFileExtension}`);
    }
  } catch (error) {
    console.log(`Error retrieving document ${docId}: ${errorToString(error)}`);
    return false;
  }
  return true;
}

function getFileExtension(value: string | undefined): string {
  if (!value || !contentType(value)) return "";
  const fileExtension = extension(value);
  return fileExtension ? `.${fileExtension}` : "";
}

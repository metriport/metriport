import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { MetriportMedicalApi } from "@metriport/api-sdk";
import { getIdFromReference } from "@metriport/core/external/fhir/shared/references";
import { sleep } from "@metriport/shared";
import axios from "axios";
import { getEnvVarOrFail } from "../../../api/src/shared/config";

const apiKey = getEnvVarOrFail("API_KEY");
const apiUrl = getEnvVarOrFail("API_URL");
const cxId = getEnvVarOrFail("CX_ID");

const metriportAPI = new MetriportMedicalApi(apiKey, {
  baseAddress: apiUrl,
});

/**
 * This script allows you to remove DocumentReferences for a list of patients for a CX.
 *
 * How to use:
 *  - Set the list of patient IDs
 *  - Configure the filters to define which DocRefs you want deleted
 *  - Run the script with ts-node src/fhir-server/remove-docrefs.ts from the `package/utils` directory
 */

const patientIds: string[] = []; // Add patient IDs here

async function deleteDocumentReferences() {
  const responses = await Promise.all(
    patientIds.map(patientId => metriportAPI.listDocuments(patientId))
  );

  for (const response of responses) {
    let patientId;
    const docRefs = response.documents;
    const documentIdSet = new Set<string>();

    // Find the DocRef IDs to delete
    for (const entry of docRefs) {
      const entryString = JSON.stringify(entry);

      // Filter for the target DocRefs - CONFIGURE PRIOR TO USE
      if (entry.id && entryString.includes(".xml_") && entryString.includes(".txt")) {
        documentIdSet.add(entry.id);
      }
    }

    for (const docId of [...documentIdSet]) {
      try {
        await axios.delete(`${apiUrl}/${cxId}/DocumentReference/${docId}?_expunge=true`);
      } catch {
        console.log("something went wrong with", docId);
      }
      await sleep(500);
    }

    const docRefPatientRef = response.documents.find(d => d.subject?.reference)?.subject;
    if (docRefPatientRef) {
      patientId = getIdFromReference(docRefPatientRef);
    }

    console.log("Done with", patientId);
    await sleep(1000);
  }
}

deleteDocumentReferences();

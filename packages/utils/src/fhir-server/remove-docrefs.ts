import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { MetriportMedicalApi } from "@metriport/api-sdk";
import { sleep } from "@metriport/shared";
import { exec } from "child_process";
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

const patientIds = [""];

async function deleteDocumentReferences() {
  for (const patientId of patientIds) {
    const docRefs = (await metriportAPI.listDocuments(patientId)).documents;
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
      const curl = `curl --location --request DELETE '${apiUrl}/${cxId}/DocumentReference/${docId}?_expunge=true'`;

      exec(curl, (error, stdout, stderr) => {
        if (error) {
          console.error(`Error: ${error.message}`);
          return;
        }
        if (stderr) {
          console.error(`stderr: ${stderr}`);
          return;
        }
        console.log(`Response: ${stdout}`);
      });
      await sleep(500);
    }

    console.log("Done with", patientId);
    await sleep(1000);
  }
}

deleteDocumentReferences();

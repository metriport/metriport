import * as dotenv from "dotenv";
import * as path from "path";
import { MetriportClient } from "../src";
import { StartDocumentQueryRequest } from "../src/api/resources/medical/resources/document/client/requests";


dotenv.config({ path: path.resolve(__dirname, '.env') });

const apiUrl = process.env.BASE_URL;
const apiToken = process.env.API_KEY;
const patientId = process.env.PATIENT_ID;
const facilityId = process.env.FACILITY_ID;

if (!apiUrl || !apiToken || !patientId || !facilityId) {
  throw new Error("Required environment variables are not set");
}

const client = new MetriportClient({
  environment: () => apiUrl,
  apiKey: () => apiToken,
});

describe("Document Query tests", () => {
  test("start document query", async () => {
    console.log("Calling start_query...");
    const requestData: StartDocumentQueryRequest = {
        facilityId: facilityId,
        patientId: patientId,
    }
    const response = await client.medical.document.startQuery(requestData);
    console.log(`response: ${JSON.stringify(response, null, 2)}`);
  });
});
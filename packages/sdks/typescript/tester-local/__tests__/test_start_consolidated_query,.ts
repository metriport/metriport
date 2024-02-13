import * as dotenv from "dotenv";
import * as path from "path";
import { MetriportClient } from "../src";
import { GetPatientConsolidatedData } from "../src/api/resources/medical/resources/fhir/client/requests";

dotenv.config({ path: path.resolve(__dirname, '.env') });

const apiUrl = process.env.BASE_URL;
const apiToken = process.env.API_KEY;
const patientId = process.env.PATIENT_ID;

if (!apiUrl || !apiToken || !patientId) {
  throw new Error("Required environment variables are not set");
}

const client = new MetriportClient({
  environment: () => apiUrl,
  apiKey: () => apiToken,
});

describe("Consolidated Query tests", () => {
  test("start consolidated query", async () => {
    console.log("Calling get_consolidated_query_status...");
    const queryStatus = await client.medical.fhir.getConsolidatedQueryStatus(patientId);
    console.log(`queryStatus: ${JSON.stringify(queryStatus, null, 2)}`);

    const requestData: GetPatientConsolidatedData = {
        resources: "DocumentReference, Appointment",
        dateFrom: "2021-03-01",
        dateTo: "2023-04-23",
    };

    console.log("Calling start_consolidated_query...");
    const response = await client.medical.fhir.startConsolidatedQuery(
      patientId,
      requestData
    );
    console.log(`response: ${JSON.stringify(response, null, 2)}`);

    console.log("Now, calling get_consolidated_query_status...");
    const queryStatus2 = await client.medical.fhir.getConsolidatedQueryStatus(patientId);
    console.log(`queryStatus: ${JSON.stringify(queryStatus2, null, 2)}`);

    console.log("Sleeping...");
    await new Promise(resolve => setTimeout(resolve, 5000));

    console.log("Calling get_consolidated_query_status again...");
    const queryStatus3 = await client.medical.fhir.getConsolidatedQueryStatus(patientId);
    console.log(`queryStatus: ${JSON.stringify(queryStatus3, null, 2)}`);

    console.log("Counting...");
    const count = await client.medical.fhir.countPatientData(patientId);
    console.log(`count: ${JSON.stringify(count, null, 2)}`);
  }, 10000);
});
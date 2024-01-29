import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(__dirname, '.env') });

import { MetriportClient } from "../src";
import { MedicalRecordSummaryRequest } from "../src/api/resources/medical/resources/patient";

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


describe("Get MR test", () => {
    test("get medical record", async () => {
        const request: MedicalRecordSummaryRequest = { conversionType: "pdf" };
        const response = await client.medical.patient.getMedicalRecordSummary(patientId, request);
        console.log(`Received medical record with URL: ${response}`);
    });

    test("get medical record status", async() => {
        const response = await client.medical.patient.getMedicalRecordSummaryStatus(patientId);
        console.log(`Received medical record status: ${response}`);
    });
});


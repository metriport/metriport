import * as dotenv from 'dotenv';
dotenv.config();
import { Metriport, MetriportClient } from "../../generated";

/**
 * Script to make it easy to test the API SDK.
 * TODO: move this to an E2E test on the API SDK itself.
 */
const apiUrl = process.env.API_URL;
const apiToken = process.env.API_KEY;
const patientId = process.env.PATIENT_ID;

if (!apiUrl || !apiToken || !patientId) {
  throw new Error('Required environment variables are not set');
}

const client = new MetriportClient({
  environment: () => apiUrl,
  apiKey: () => apiToken,
});

describe('Patient tests', () => {
  test('get all patients', async () => {
    const response = await client.medical.patient.list();
    for (const patient of response.patients) {
      console.log(`Received patient with ID: ${patient.id}`);
    }
  });

  test('get specific patient', async () => {
    const response = await client.medical.patient.get(patientId);
    console.log(`Received specific patient with ID: ${response.id}`);
  });
});
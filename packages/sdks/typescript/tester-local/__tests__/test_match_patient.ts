import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(__dirname, '.env') });

import { MetriportClient } from "../src";
import { BasePatient, Demographics } from "../src/api/resources/medical/resources/patient/types";
import { PatientCreate } from "../src/api/resources/medical/resources/patient/client/requests";
import { UsState, Address } from "../src/api/resources/commons/types";

const apiUrl = process.env.BASE_URL;
const apiToken = process.env.API_KEY;
const facilityId = process.env.FACILITY_ID;

if (!apiUrl || !apiToken || !facilityId) {
  throw new Error("Required environment variables are not set");
}

const metriport = new MetriportClient({
  environment: () => apiUrl,
  apiKey: () => apiToken,
});

describe("Patient tests", () => {
  test("match a patient", async () => {
    const patientData: BasePatient = {
      firstName: "John",
      lastName: "Doe",
      dob: "1980-01-01",
      genderAtBirth: "M",
      personalIdentifiers: [{
          type: "driversLicense",
          state: UsState.Ca,
          value: "12345678",
        }],
      address: [{
          addressLine1: "123 Main St",
          city: "Los Angeles",
          state: UsState.Ca,
          zip: "90001",
          country: "USA",
        }],
    };

    const createRequest: PatientCreate = {
        facilityId: facilityId,
        body: patientData
      };

    await metriport.medical.patient.create(createRequest);
    
    const patientDemoData: Demographics = {
      firstName: "John",
      lastName: "Doe",
      dob: "1980-01-01",
      genderAtBirth: "M",
      personalIdentifiers: [{
          type: "driversLicense",
          state: UsState.Ca,
          value: "12345678",
        }],
      address: [{
          addressLine1: "123 Main St",
          city: "Los Angeles",
          state: UsState.Ca,
          zip: "90001",
          country: "USA",
        }],
    };

    const response = await metriport.medical.patient.match(patientDemoData);
    console.log(`Received patient with ID: ${response.id}`);
  });
});

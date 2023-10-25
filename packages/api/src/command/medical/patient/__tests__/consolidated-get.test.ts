/* eslint-disable @typescript-eslint/no-empty-function */
import { Observation } from "@medplum/fhirtypes";
import { HapiFhirClient } from "@metriport/core/external/fhir/api/api-hapi";
import { v4 as uuidv4 } from "uuid";
import { makePatient } from "../../../../models/medical/__tests__/patient";
import { getConsolidatedPatientData } from "../consolidated-get";
import * as getPatient from "../get-patient";
import { calculatePatientSimilarity} from "../get-patient";
import { PatientData } from "../../../../models/medical/patient";


let getPatientOrFailMock: jest.SpyInstance;
let fhir_searchResourcePages: jest.SpyInstance;
beforeEach(() => {
  jest.restoreAllMocks();
  getPatientOrFailMock = jest.spyOn(getPatient, "getPatientOrFail");
  fhir_searchResourcePages = jest.spyOn(HapiFhirClient.prototype, "searchResourcePages");
});

describe("getConsolidatedPatientData", () => {
  const cxId = uuidv4();
  const patientId = uuidv4();

  it("paginates appropriately", async () => {
    getPatientOrFailMock.mockReturnValueOnce(makePatient({ id: patientId }));

    const returnedResource: Observation = {
      resourceType: "Observation",
      id: "1",
      status: "final",
      code: {
        coding: [
          {
            system: "http://loinc.org",
            code: "12345",
            display: "Test",
          },
        ],
      },
    };
    const generator = (async function* generateResources() {
      yield [returnedResource];
      yield [returnedResource];
    })();
    fhir_searchResourcePages.mockReturnValue(generator);

    const resp = await getConsolidatedPatientData({
      patient: { cxId, id: patientId },
      resources: ["Observation"],
    });

    expect(resp).toBeTruthy();
    expect(resp.resourceType).toEqual(`Bundle`);
    expect(resp.total).toEqual(2);
    expect(resp.entry).toEqual(expect.arrayContaining([{ resource: returnedResource }]));
    expect(fhir_searchResourcePages).toHaveBeenCalledTimes(1);
  });
});


const patient1: PatientData = {
  firstName: 'Jose',
  lastName: 'Juarez',
  dob: '1951-05-05',
  genderAtBirth: 'M',
  address: [{
    zip: '12345',
    city: 'San Diego',
    state: 'CA',
    country: 'USA',
    addressLine1: 'Guadalajara St'
  }],
  contact: [{
    phone: '1234567899',
    email: 'jose@domain.com'
  }]
};

const patient2: PatientData = {
  firstName: 'Josef',
  lastName: 'Juarez',
  dob: '1951-05-05',
  genderAtBirth: 'M',
  address: [{
    zip: '12345',
    city: 'San Diego',
    state: 'CA',
    country: 'USA',
    addressLine1: 'Guadalajara St'
  }],
  contact: [{
    phone: '1234567899',
    email: 'jose@domain.com'
  }]
};

describe("getConsolidatedPatientData", () => {

  it("calculates patient similarity correctly", async () => {
    
    const similarityScore = calculatePatientSimilarity(patient1, patient2);

    console.log('Similarity Score:', similarityScore);
    expect(similarityScore).toBeCloseTo(0.99, 1); // Replace 'expectedScore' with the expected similarity score
  });
});

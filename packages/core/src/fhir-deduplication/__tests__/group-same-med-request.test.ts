import { faker } from "@faker-js/faker";
import { MedicationRequest } from "@medplum/fhirtypes";
import { groupSameMedRequests } from "../resources/medication-request";
import { makeMedicationRequest } from "./examples/medication-related";

let medRequestId: string;
let medRequestId2: string;
let medRequest: MedicationRequest;
let medRequest2: MedicationRequest;

beforeEach(() => {
  medRequestId = faker.string.uuid();
  medRequestId2 = faker.string.uuid();
  medRequest = makeMedicationRequest({ id: medRequestId });
  medRequest2 = makeMedicationRequest({ id: medRequestId2 });
});

describe("groupSameMedStatements", () => {
  it("correctly groups duplicate medRequests based on medRef and date", () => {
    const { medRequestsMap } = groupSameMedRequests([medRequest, medRequest2]);
    expect(medRequestsMap.size).toBe(1);
  });
});

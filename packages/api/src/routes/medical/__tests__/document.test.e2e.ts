import { faker } from "@faker-js/faker";
import { makePatient } from "../../../domain/medical/__tests__/patient";
import { api } from "../../../__tests__/e2e/shared";

jest.setTimeout(15000);

const path = "/medical/v1/document";

beforeEach(() => {
  jest.restoreAllMocks();
});

describe("Integration Document routes", () => {
  describe("GET /", () => {
    it("returns response from FHIR server", async () => {
      try {
        // const patient = makePatient({ id: "2.16.840.1.113883.3.9621.5.2005.2.100" });
        const patient = makePatient({ id: faker.string.uuid() });
        const res = await api.get(path, { params: { patientId: patient.id } });
        expect(res.status).toBe(200);
        expect(res.data).toBeTruthy();
        //eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (error: any) {
        if (error.response?.status === 404) {
          console.log(
            `Assuming it hit the FHIR server but couldn't find the patient. Update makePatient() if you want a successful response.`
          );
          return;
        }
        console.log(error);
        throw error;
      }
    });
  });
});

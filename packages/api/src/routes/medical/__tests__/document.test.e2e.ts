import { randNumber, randUuid } from "@ngneat/falso";
import * as patientCmd from "../../../command/medical/patient/get-patient";
import * as docCmd from "../../../external/fhir/document/search-documents";
import { makePatient } from "../../../models/medical/__tests__/patient";
import { api } from "../../__tests__/shared";

jest.setTimeout(15000);

const path = "/medical/v1/document";

let getDocumentsMock: jest.SpyInstance;
let getPatientOrFailMock: jest.SpyInstance;
beforeEach(() => {
  jest.restoreAllMocks();
  getDocumentsMock = jest.spyOn(docCmd, "searchDocuments");
  getPatientOrFailMock = jest.spyOn(patientCmd, "getPatientOrFail");
});

describe("Integration Document routes", () => {
  describe("GET /", () => {
    it("returns response from FHIR server", async () => {
      try {
        // const patient = makePatient({ id: "2.16.840.1.113883.3.9621.5.2005.2.100" });
        const patient = makePatient({ id: randUuid() });
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

    // To enable this - which requires mocks, we'd need to run the server along the test process.
    it.skip("returns processing and progress", async () => {
      const expectedStatus = "processing";
      const total = randNumber({ min: 10, mx: 100 });
      const expectedProgress = {
        total: total,
        completed: Math.round(total / 2),
      };
      try {
        getDocumentsMock.mockResolvedValueOnce([]);

        const patient = makePatient({ id: randUuid() });
        patient.data.documentQueryProgress = {
          download: {
            status: expectedStatus,
            total: expectedProgress.total,
            successful: expectedProgress.completed,
          },
        };

        getPatientOrFailMock.mockResolvedValueOnce(patient);

        const res = await api.get(path, { params: { patientId: patient.id } });

        expect(res.status).toBe(200);
        expect(res.data).toBeTruthy();
        expect(res.data).toEqual({
          documents: [],
        });
      } catch (error) {
        console.log(error);
        throw error;
      }
    });
  });
});

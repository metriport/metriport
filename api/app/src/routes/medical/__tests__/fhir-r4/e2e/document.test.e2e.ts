import { AxiosResponse } from "axios";
import { asyncTest } from "../../../../../__tests__/shared";
import { makeBinary } from "./binary";
import { makeDocument } from "./document";
import { makePatient } from "./patient";
import { fhirApi } from "./shared";

const binary = makeBinary();
const patient = makePatient();
const document = makeDocument({ patient, binary });

describe("Integration FHIR Document", () => {
  test(
    "Binary upload",
    asyncTest(async () => {
      const res = await fhirApi.put(`/fhir/R4/Binary/${binary.id}`, binary);
      expect(res.status).toBe(201);
      expect(res.data).toBeTruthy();
      validateBinary(res.data);
    })
  );

  test(
    "Binary download",
    asyncTest(async () => {
      const res = await fhirApi.get(`/fhir/R4/Binary/${binary.id}`);
      expect(res.status).toBe(200);
      validateBinary(res.data);
      expect(res.data.data).toEqual(binary.data);
    })
  );

  describe("Document Reference", () => {
    test(
      "create document",
      asyncTest(async () => {
        const resPatient = await fhirApi.put(`/fhir/R4/Patient/${patient.id}`, patient);
        expect(resPatient.status).toBe(201);

        const res = await fhirApi.put(`/fhir/R4/DocumentReference/${document.id}`, document);
        expect(res.status).toBe(201);
        expect(res.data).toBeTruthy();
        validateDocument(res.data);
      })
    );

    test(
      "get document",
      asyncTest(async () => {
        const res = await fhirApi.get(`/fhir/R4/DocumentReference/${document.id}`);
        expect(res.status).toBe(200);
        expect(res.data).toBeTruthy();
        validateDocument(res.data);
      })
    );

    describe(`delete`, () => {
      test(
        "delete document",
        asyncTest(async () => {
          const res = await fhirApi.delete(`/fhir/R4/DocumentReference/${document.id}`);
          validateDeleteResponse(res, "SUCCESSFUL_DELETE");
        })
      );

      test(
        "sequential delete document",
        asyncTest(async () => {
          const res = await fhirApi.delete(`/fhir/R4/DocumentReference/${document.id}`);
          validateDeleteResponse(res, "SUCCESSFUL_DELETE_ALREADY_DELETED");
        })
      );
    });
  });

  describe(`Binary delete`, () => {
    test(
      "delete binary",
      asyncTest(async () => {
        const res = await fhirApi.delete(`/fhir/R4/Binary/${binary.id}`);
        validateDeleteResponse(res, "SUCCESSFUL_DELETE");
      })
    );

    test(
      "sequential delete binary",
      asyncTest(async () => {
        const res = await fhirApi.delete(`/fhir/R4/Binary/${binary.id}`);
        validateDeleteResponse(res, "SUCCESSFUL_DELETE_ALREADY_DELETED");
      })
    );
  });
});

//eslint-disable-next-line @typescript-eslint/no-explicit-any
function validateBinary(body: any) {
  expect(body).toBeTruthy();
  expect(body.resourceType).toEqual("Binary");
  expect(body.id).toEqual(binary.id);
}

//eslint-disable-next-line @typescript-eslint/no-explicit-any
function validateDocument(body: any) {
  expect(body.resourceType).toBeTruthy();
  expect(body.resourceType).toBe("DocumentReference");
  expect(body.id).toBeTruthy();
  expect(body.id).toBe(document.id);
  expect(body.identifier).toBeTruthy();
  expect(body.identifier.length).toBeTruthy();
  expect(body.identifier[0]).toEqual(document.identifier[0]);
  // Could validate more data here
}

function validateDeleteResponse(res: AxiosResponse, expectedResponse: string) {
  expect(res.status).toBe(200);
  const body = res.data;
  expect(body.resourceType).toBeTruthy();
  expect(body.resourceType).toBe("OperationOutcome");
  expect(body.issue).toBeTruthy();
  expect(body.issue.length).toEqual(1);
  const issue = body.issue[0];
  expect(issue.details).toBeTruthy();
  expect(issue.details.coding).toBeTruthy();
  expect(issue.details.coding.length).toEqual(1);
  const coding = issue.details.coding[0];
  expect(coding.code).toEqual(expectedResponse);
}

/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { makeBinary } from "@metriport/core/external/fhir/__tests__/binary";
import { makeDocumentReference } from "@metriport/core/external/fhir/__tests__/document-reference";
import { makePatient } from "@metriport/core/external/fhir/__tests__/patient";
import { sendNotification } from "@metriport/core/external/slack/index";
import { base64ToString } from "@metriport/core/util/base64";
import { AxiosResponse } from "axios";
import { api, testApiKey } from "../../../../__tests__/shared";

jest.setTimeout(15000);

const binary = makeBinary();
const patient = makePatient();
const document = makeDocumentReference({ patient, binary });

beforeAll(async () => {
  await api.put(`/fhir/R4/Patient/${patient.id}`, patient);

  // TODO remove this
  const decodedKey = base64ToString(testApiKey);
  const [, cxId] = decodedKey.split(":");
  sendNotification({
    message: cxId,
    subject: "@Raf - `cxId` for e2e testing",
  });
});
afterAll(async () => {
  await api.delete(`/fhir/R4/Patient/${patient.id}`);
});

describe("Integration FHIR Document", () => {
  test("Binary upload", async () => {
    const res = await api.put(`/fhir/R4/Binary/${binary.id}`, binary);
    expect(res.status).toBe(201);
    expect(res.data).toBeTruthy();
    validateBinary(res.data);
  });

  test("Binary download", async () => {
    const res = await api.get(`/fhir/R4/Binary/${binary.id}`);
    expect(res.status).toBe(200);
    validateBinary(res.data);
    expect(res.data.data).toEqual(binary.data);
  });

  describe("Document Reference", () => {
    test("create document", async () => {
      console.log(`Creating document (id ${document.id}): ${JSON.stringify(document)}`);
      const res = await api.put(`/fhir/R4/DocumentReference/${document.id}`, document);
      expect(res.status).toBe(201);
      expect(res.data).toBeTruthy();
      validateDocument(res.data);
    });

    test("get document", async () => {
      const res = await api.get(`/fhir/R4/DocumentReference/${document.id}`);
      expect(res.status).toBe(200);
      expect(res.data).toBeTruthy();
      validateDocument(res.data);
    });

    describe(`delete`, () => {
      test("delete document", async () => {
        const res = await api.delete(`/fhir/R4/DocumentReference/${document.id}`);
        validateDeleteResponse(res, "SUCCESSFUL_DELETE");
      });

      test("sequential delete document", async () => {
        const res = await api.delete(`/fhir/R4/DocumentReference/${document.id}`);
        validateDeleteResponse(res, "SUCCESSFUL_DELETE_ALREADY_DELETED");
      });
    });
  });

  describe(`Binary delete`, () => {
    test("delete binary", async () => {
      const res = await api.delete(`/fhir/R4/Binary/${binary.id}`);
      validateDeleteResponse(res, "SUCCESSFUL_DELETE");
    });

    test("sequential delete binary", async () => {
      const res = await api.delete(`/fhir/R4/Binary/${binary.id}`);
      validateDeleteResponse(res, "SUCCESSFUL_DELETE_ALREADY_DELETED");
    });
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
  expect(body.identifier[0]).toEqual(document.identifier![0]);
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

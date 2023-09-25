/* eslint-disable @typescript-eslint/no-empty-function */
import dayjs from "dayjs";
import { v4 as uuidv4 } from "uuid";
import { getEnvVar, getEnvVarOrFail, ISO_DATE } from "../../../shared";
import { MetriportMedicalApi } from "../metriport";

jest.setTimeout(15000);

const METRIPORT = "METRIPORT";
const COMMONWELL = "COMMONWELL";

const apiKey = getEnvVarOrFail("TEST_API_KEY");
const baseAddress = getEnvVarOrFail("API_URL");
const patientId = getEnvVar("TEST_PATIENT_ID");

const metriport = new MetriportMedicalApi(apiKey, { baseAddress });

describe("listDocuments", () => {
  if (!patientId) {
    console.log(`Missing TEST_PATIENT_ID env var, SKIPPING E2E TESTS!!!`);
    it.skip("skipping e2e tests", () => {});
    return;
  }

  // TODO we should have a beforeAll()/afterAll() to setup/teardown the test data
  // so the result of the tests is more deterministic.
  // As an alternative, could move these to the API's metriport.test.e2e.ts

  it("returns documents when no filters", async () => {
    const { documents } = await metriport.listDocuments(patientId);
    expect(documents).toBeTruthy();
    expect(documents.length).toBeGreaterThanOrEqual(1);
  });

  it("returns no documents when dateFrom is future", async () => {
    const filters = { dateFrom: dayjs().add(3, "day").format(ISO_DATE) };
    const { documents } = await metriport.listDocuments(patientId, filters);
    expect(documents).toBeTruthy();
    expect(documents.length).toEqual(0);
  });

  it("returns no documents when dateTo is ancient", async () => {
    const filters = {
      dateTo: dayjs().subtract(100, "years").format(ISO_DATE),
    };
    const { documents } = await metriport.listDocuments(patientId, filters);
    expect(documents).toBeTruthy();
    expect(documents.length).toEqual(0);
  });

  it("returns documents when dateFrom is past", async () => {
    const filters = {
      dateFrom: dayjs().subtract(10, "years").format(ISO_DATE),
    };
    const { documents } = await metriport.listDocuments(patientId, filters);
    expect(documents).toBeTruthy();
    expect(documents.length).toBeGreaterThanOrEqual(1);
  });

  it("converts dateFrom Date to ISO string", async () => {
    const filters = {
      dateFrom: dayjs().subtract(10, "years").toDate(),
    };
    const { documents } = await metriport.listDocuments(patientId, filters);
    expect(documents).toBeTruthy();
    expect(documents.length).toBeGreaterThanOrEqual(1);
  });

  it("returns documents when dateTo is today", async () => {
    const filters = {
      dateTo: dayjs().format(ISO_DATE),
    };
    const { documents } = await metriport.listDocuments(patientId, filters);
    expect(documents).toBeTruthy();
    expect(documents.length).toBeGreaterThanOrEqual(1);
  });

  it("converts dateFrom Date to ISO string", async () => {
    const filters = {
      dateTo: new Date(),
    };
    const { documents } = await metriport.listDocuments(patientId, filters);
    expect(documents).toBeTruthy();
    expect(documents.length).toBeGreaterThanOrEqual(1);
  });

  it("returns documents filtering by content", async () => {
    const filters = {
      content: "org",
    };
    const { documents } = await metriport.listDocuments(patientId, filters);
    expect(documents).toBeTruthy();
    expect(documents.length).toBeGreaterThanOrEqual(1);
  });

  it("does not return documents filtering by unknown content", async () => {
    const filters = {
      content: uuidv4(),
    };
    const { documents } = await metriport.listDocuments(patientId, filters);
    expect(documents).toBeTruthy();
    expect(documents.length).toEqual(0);
  });

  it("fails if content filter is less than 3 chars", async () => {
    const filters = {
      content: "jo",
    };
    await expect(metriport.listDocuments(patientId, filters)).rejects.toThrow();
  });

  it("returns documents when all filters are combined", async () => {
    const filters = {
      dateFrom: dayjs().subtract(10, "years").format(ISO_DATE),
      dateTo: dayjs().add(1, "day").format(ISO_DATE),
      content: "org",
    };
    const { documents } = await metriport.listDocuments(patientId, filters);
    expect(documents).toBeTruthy();
    expect(documents.length).toBeGreaterThanOrEqual(1);
  });

  it("returns document in FHIR format", async () => {
    const filters = {
      dateFrom: dayjs().subtract(10, "years").format(ISO_DATE),
      dateTo: dayjs().add(1, "day").format(ISO_DATE),
      content: "john",
    };
    const { documents } = await metriport.listDocuments(patientId, filters);
    expect(documents).toBeTruthy();
    expect(documents.length).toBeGreaterThanOrEqual(1);
    const doc = documents[0];
    expect(doc.resourceType).toEqual("DocumentReference");
    expect(doc.id).toBeTruthy();
    expect(doc.meta).toBeTruthy();
    expect(doc.contained).toBeTruthy();
    expect(doc.extension).toBeTruthy();
    expect(doc.masterIdentifier).toBeTruthy();
    expect(doc.identifier).toBeTruthy();
    expect(doc.status).toBeTruthy();
    expect(doc.type).toBeTruthy();
    expect(doc.date).toBeTruthy();
    expect(doc.author).toBeTruthy();
    expect(doc.content).toBeTruthy();
  });

  it("only returns doc refs from Metriport and HIEs", async () => {
    const expectedExtensionCodes = [METRIPORT, COMMONWELL];
    const { documents } = await metriport.listDocuments(patientId);
    expect(documents).toBeTruthy();
    expect(documents.length).toBeGreaterThanOrEqual(1);
    const docsWithValidExtensions = documents.filter(doc => {
      const contains = doc.extension?.filter(
        e => e.valueCoding?.code && expectedExtensionCodes.includes(e.valueCoding?.code)
      );
      return contains && contains.length > 0;
    }).length;
    expect(docsWithValidExtensions).toEqual(documents.length);
  });

  it("returns documents as DTO", async () => {
    const documents = await metriport.listDocumentsAsDTO(patientId);
    expect(documents).toBeTruthy();
    expect(documents.length).toBeGreaterThanOrEqual(1);
    const doc = documents[0];
    expect(doc.id).toBeTruthy();
    expect(doc.description).toBeTruthy();
    expect(doc.fileName).toBeTruthy();
    expect(doc.type).toBeTruthy();
    expect(doc.status).toBeTruthy();
    expect(doc.mimeType).toBeTruthy();
    expect(doc.size).toBeTruthy();
  });
});

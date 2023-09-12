/* eslint-disable @typescript-eslint/no-empty-function */
import dayjs from "dayjs";
import { v4 as uuidv4 } from "uuid";
import { getEnvVar, getEnvVarOrFail, ISO_DATE } from "../../../shared";
import { MetriportMedicalApi } from "../metriport";

const apiKey = getEnvVarOrFail("TEST_API_KEY");
const baseAddress = getEnvVarOrFail("API_URL");
const patientId = getEnvVar("TEST_PATIENT_ID");

if (!patientId) {
  console.log(`Missing TEST_PATIENT_ID env var, SKIPPING E2E TESTS!!!`);
  it.skip("skipping e2e tests", () => {});
} else {
  const metriport = new MetriportMedicalApi(apiKey, { baseAddress });

  describe("getMetriportUserId", () => {
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

    it("returns documents filtering by Org", async () => {
      const filters = {
        organization: "org",
      };
      const { documents } = await metriport.listDocuments(patientId, filters);
      expect(documents).toBeTruthy();
      expect(documents.length).toBeGreaterThanOrEqual(1);
    });

    it("does not return documents filtering by unknown Org", async () => {
      const filters = {
        organization: uuidv4(),
      };
      const { documents } = await metriport.listDocuments(patientId, filters);
      expect(documents).toBeTruthy();
      expect(documents.length).toEqual(0);
    });

    it("returns documents filtering by Practitioner", async () => {
      const filters = {
        practitioner: "john",
      };
      const { documents } = await metriport.listDocuments(patientId, filters);
      expect(documents).toBeTruthy();
      expect(documents.length).toBeGreaterThanOrEqual(1);
    });

    it("does not return documents filtering by unknown Practitioner", async () => {
      const filters = {
        practitioner: uuidv4(),
      };
      const { documents } = await metriport.listDocuments(patientId, filters);
      expect(documents).toBeTruthy();
      expect(documents.length).toEqual(0);
    });

    it("returns documents when all filters are combined", async () => {
      const filters = {
        dateFrom: dayjs().subtract(10, "years").format(ISO_DATE),
        dateTo: dayjs().add(1, "day").format(ISO_DATE),
        organization: "org",
        practitioner: "john",
      };
      const { documents } = await metriport.listDocuments(patientId, filters);
      expect(documents).toBeTruthy();
      expect(documents.length).toBeGreaterThanOrEqual(1);
    });

    it("returns document in FHIR format", async () => {
      const filters = {
        dateFrom: dayjs().subtract(10, "years").format(ISO_DATE),
        dateTo: dayjs().add(1, "day").format(ISO_DATE),
        organization: "org",
        practitioner: "john",
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
  });
}

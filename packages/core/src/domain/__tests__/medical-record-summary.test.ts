import { faker } from "@faker-js/faker";
import { createMRSummaryFileName } from "../medical-record-summary";

describe("medical-record-summary", () => {
  describe("createMRSummaryFileName", () => {
    it(`builds pathname with HTML extension`, async () => {
      const cxId = faker.string.uuid();
      const patientId = faker.string.uuid();
      const result = createMRSummaryFileName(cxId, patientId, "html");
      expect(result).toBeTruthy();
      expect(result).toEqual(`${cxId}/${patientId}/${cxId}_${patientId}_MR.html`);
    });

    it(`builds pathname with PDF extension`, async () => {
      const cxId = faker.string.uuid();
      const patientId = faker.string.uuid();
      const result = createMRSummaryFileName(cxId, patientId, "pdf");
      expect(result).toBeTruthy();
      expect(result).toEqual(`${cxId}/${patientId}/${cxId}_${patientId}_MR.html.pdf`);
    });

    it(`builds pathname with HTML extension when dedupEnabled is false`, async () => {
      const cxId = faker.string.uuid();
      const patientId = faker.string.uuid();
      const result = createMRSummaryFileName(cxId, patientId, "html", false);
      expect(result).toBeTruthy();
      expect(result).toEqual(`${cxId}/${patientId}/${cxId}_${patientId}_MR.html`);
    });

    it(`builds pathname with PDF extension when dedupEnabled is false`, async () => {
      const cxId = faker.string.uuid();
      const patientId = faker.string.uuid();
      const result = createMRSummaryFileName(cxId, patientId, "pdf", false);
      expect(result).toBeTruthy();
      expect(result).toEqual(`${cxId}/${patientId}/${cxId}_${patientId}_MR.html.pdf`);
    });

    it(`builds pathname with HTML extension when dedupEnabled is true`, async () => {
      const cxId = faker.string.uuid();
      const patientId = faker.string.uuid();
      const result = createMRSummaryFileName(cxId, patientId, "html", true);
      expect(result).toBeTruthy();
      expect(result).toEqual(`${cxId}/${patientId}/${cxId}_${patientId}_MR_deduped.html`);
    });

    it(`builds pathname with PDF extension when dedupEnabled is true`, async () => {
      const cxId = faker.string.uuid();
      const patientId = faker.string.uuid();
      const result = createMRSummaryFileName(cxId, patientId, "pdf", true);
      expect(result).toBeTruthy();
      expect(result).toEqual(`${cxId}/${patientId}/${cxId}_${patientId}_MR_deduped.html.pdf`);
    });
  });
});

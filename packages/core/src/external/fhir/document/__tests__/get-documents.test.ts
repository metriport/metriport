import { faker } from "@faker-js/faker";
import { ISO_DATE } from "@metriport/shared/common/date";
import dayjs from "dayjs";
import { trim } from "lodash";
import { v4 as uuidv4 } from "uuid";
import { getFilters } from "../get-documents";

beforeEach(() => {
  jest.restoreAllMocks();
});

describe("getDocuments", () => {
  describe("getFilters", () => {
    it("returns empty string when no params", async () => {
      const res = getFilters({});
      expect(res).toEqual("");
    });

    it("returns patientId when only patientId is set", async () => {
      const patientId = faker.string.uuid();
      const res = getFilters({ patientId });
      expect(res).toEqual("patient=" + patientId);
    });

    it("returns list of patientId when gets patientId as array", async () => {
      const patientIds = [faker.string.uuid(), faker.string.uuid(), faker.string.uuid()];
      const encodedPatientIds = encodeURIComponent(patientIds.join(","));
      const res = getFilters({ patientId: patientIds });
      expect(res).toEqual("patient=" + encodedPatientIds);
    });

    it("trims patientIds", async () => {
      const patientIds = [faker.string.uuid() + " ", " " + faker.string.uuid()];
      const encodedPatientIds = encodeURIComponent(patientIds.map(trim).join(","));
      const res = getFilters({ patientId: patientIds });
      expect(res).toEqual("patient=" + encodedPatientIds);
    });

    it("returns `from` when only `from` is set", async () => {
      const from = dayjs(faker.date.past()).format(ISO_DATE);
      const res = getFilters({ from });
      expect(res).toEqual("date=ge" + from);
    });

    it("returns `to` when only `to` is set", async () => {
      const to = dayjs(faker.date.past()).format(ISO_DATE);
      const res = getFilters({ to });
      expect(res).toEqual("date=le" + to);
    });

    it("returns document IDs when only `documentIds` is set", async () => {
      const documentIds = [uuidv4(), uuidv4()];
      const res = getFilters({ documentIds });
      expect(res).toEqual("_id=" + documentIds.join(encodeURIComponent(",")));
    });

    it("groups patientId and documentIds when both are set", async () => {
      const patientId = faker.string.uuid();
      const documentIds = [uuidv4(), uuidv4()];
      const res = getFilters({ patientId: patientId, documentIds });
      expect(res).toEqual(
        "patient=" + patientId + "&_id=" + documentIds.join(encodeURIComponent(","))
      );
    });

    it("groups patientId and dates when those are set", async () => {
      const patientId = faker.string.uuid();
      const from = dayjs(faker.date.past()).format(ISO_DATE);
      const to = dayjs(faker.date.past()).format(ISO_DATE);
      const res = getFilters({ patientId, from, to });
      expect(res).toEqual("patient=" + patientId + "&date=ge" + from + "&date=le" + to);
    });

    it("groups documentIds and dates when those are set", async () => {
      const documentIds = [uuidv4(), uuidv4()];
      const from = dayjs(faker.date.past()).format(ISO_DATE);
      const to = dayjs(faker.date.past()).format(ISO_DATE);
      const res = getFilters({ documentIds, from, to });
      expect(res).toEqual(
        "_id=" + documentIds.join(encodeURIComponent(",")) + "&date=ge" + from + "&date=le" + to
      );
    });

    it("groups all when all are set", async () => {
      const patientId = faker.string.uuid();
      const documentIds = [uuidv4(), uuidv4()];
      const from = dayjs(faker.date.past()).format(ISO_DATE);
      const to = dayjs(faker.date.past()).format(ISO_DATE);
      const res = getFilters({ patientId: patientId, documentIds, from, to });
      expect(res).toEqual(
        "patient=" +
          patientId +
          "&_id=" +
          documentIds.join(encodeURIComponent(",")) +
          "&date=ge" +
          from +
          "&date=le" +
          to
      );
    });
  });
});

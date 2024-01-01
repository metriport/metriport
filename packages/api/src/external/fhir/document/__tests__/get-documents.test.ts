import { faker } from "@faker-js/faker";
import dayjs from "dayjs";
import { v4 as uuidv4 } from "uuid";
import { makePatient } from "../../../../domain/medical/__tests__/patient";
import { ISO_DATE } from "../../../../shared/date";
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
      const patient = makePatient();
      const res = getFilters({ patientId: patient.id });
      expect(res).toEqual("patient=" + patient.id);
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
      const patient = makePatient();
      const documentIds = [uuidv4(), uuidv4()];
      const res = getFilters({ patientId: patient.id, documentIds });
      expect(res).toEqual(
        "patient=" + patient.id + "&_id=" + documentIds.join(encodeURIComponent(","))
      );
    });

    it("groups patientId and dates when those are set", async () => {
      const patient = makePatient();
      const from = dayjs(faker.date.past()).format(ISO_DATE);
      const to = dayjs(faker.date.past()).format(ISO_DATE);
      const res = getFilters({ patientId: patient.id, from, to });
      expect(res).toEqual("patient=" + patient.id + "&date=ge" + from + "&date=le" + to);
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
      const patient = makePatient();
      const documentIds = [uuidv4(), uuidv4()];
      const from = dayjs(faker.date.past()).format(ISO_DATE);
      const to = dayjs(faker.date.past()).format(ISO_DATE);
      const res = getFilters({ patientId: patient.id, documentIds, from, to });
      expect(res).toEqual(
        "patient=" +
          patient.id +
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

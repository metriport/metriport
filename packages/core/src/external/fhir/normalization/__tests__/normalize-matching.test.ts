import { buildDayjs } from "@metriport/shared/common/date";
import {
  linkProceduresToDiagnosticReports,
  doAnyDatesMatchThroughWindow,
  SIZE_OF_WINDOW,
} from "../link-procedures-to-reports";
import { makeProcedure } from "../../../../fhir-to-cda/cda-templates/components/__tests__/make-procedure";
import { makeDiagnosticReport } from "../../../../fhir-to-cda/cda-templates/components/__tests__/make-diagnostic-report";

describe("linkProceduresToDiagnosticReports", () => {
  let baseMs: number;
  let DATE_TO_MATCH: string;

  const defaultIdentifier = [
    {
      value: "TEST123",
      system: "http://example.com/ids",
    },
  ];

  beforeAll(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2025-01-02T12:00:00.000Z"));
    baseMs = Date.now();
    DATE_TO_MATCH = buildDayjs(baseMs).toISOString();
  });

  afterAll(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  describe("matchDates", () => {
    it("should match based off dates", () => {
      const matchingDate = buildDayjs(baseMs + SIZE_OF_WINDOW.asMilliseconds() / 2).toISOString();
      const notMatchingDate = buildDayjs(
        baseMs + SIZE_OF_WINDOW.asMilliseconds() * 2
      ).toISOString();
      const barelyNotMatchingDate = buildDayjs(
        baseMs + (SIZE_OF_WINDOW.asMilliseconds() + 1)
      ).toISOString();

      const shouldMatch = doAnyDatesMatchThroughWindow([DATE_TO_MATCH], [matchingDate]);
      const shouldNotMatch = doAnyDatesMatchThroughWindow([DATE_TO_MATCH], [notMatchingDate]);
      const barelyNotMatch = doAnyDatesMatchThroughWindow([DATE_TO_MATCH], [barelyNotMatchingDate]);

      expect(shouldMatch).toBe(true);
      expect(shouldNotMatch).toBe(false);
      expect(barelyNotMatch).toBe(false);
    });

    it("should return false when either array is empty", () => {
      expect(doAnyDatesMatchThroughWindow([], [DATE_TO_MATCH])).toBe(false);
      expect(doAnyDatesMatchThroughWindow([DATE_TO_MATCH], [])).toBe(false);
      expect(doAnyDatesMatchThroughWindow([], [])).toBe(false);
    });

    it("should return false when no valid dates are found", () => {
      expect(doAnyDatesMatchThroughWindow(["invalid-date"], ["another-invalid-date"])).toBe(false);
    });

    it("should handle multiple dates in arrays", () => {
      const matchingDate1 = buildDayjs(baseMs + SIZE_OF_WINDOW.asMilliseconds() / 2).toISOString();
      const matchingDate2 = buildDayjs(baseMs + SIZE_OF_WINDOW.asMilliseconds() / 3).toISOString();
      const notMatchingDate = buildDayjs(
        baseMs + SIZE_OF_WINDOW.asMilliseconds() * 2
      ).toISOString();

      expect(doAnyDatesMatchThroughWindow([DATE_TO_MATCH], [matchingDate1, notMatchingDate])).toBe(
        true
      );
      expect(doAnyDatesMatchThroughWindow([DATE_TO_MATCH], [notMatchingDate, matchingDate2])).toBe(
        true
      );
    });
  });

  describe("linkProceduresToDiagnosticReports", () => {
    it("should link procedure to diagnostic report when codes match and dates are within window", () => {
      const matchingDate = buildDayjs(baseMs + SIZE_OF_WINDOW.asMilliseconds() / 2).toISOString();
      const sharedCode = "55555";

      const procedure = makeProcedure({
        code: {
          coding: [
            {
              code: sharedCode,
              system: "http://www.ama-assn.org/go/cpt",
            },
          ],
        },
        performedDateTime: DATE_TO_MATCH,
        identifier: [
          {
            value: "PROC123",
            system: "http://example.com/ids",
          },
        ],
      });

      const diagnosticReport = makeDiagnosticReport({
        code: {
          coding: [
            {
              code: sharedCode,
              system: "http://www.ama-assn.org/go/cpt",
            },
          ],
        },
        effectiveDateTime: matchingDate,
        identifier: [
          {
            value: "DR123",
            system: "http://example.com/ids",
          },
        ],
      });

      const result = linkProceduresToDiagnosticReports([procedure], [diagnosticReport]);

      expect(result).toBeDefined();
      expect(result[0]).toBeDefined();
      expect(result[0]?.report).toBeDefined();
      expect(result[0]?.report).toHaveLength(1);
      expect(result[0]?.report?.[0]?.reference).toBe(`DiagnosticReport/${diagnosticReport.id}`);
    });

    it("should not link when codes don't match", () => {
      const matchingDate = buildDayjs(baseMs + SIZE_OF_WINDOW.asMilliseconds() / 2).toISOString();

      const procedure = makeProcedure({
        code: {
          coding: [
            {
              code: "55555",
              system: "http://www.ama-assn.org/go/cpt",
            },
          ],
        },
        performedDateTime: DATE_TO_MATCH,
        identifier: [
          {
            value: "PROC123",
            system: "http://example.com/ids",
          },
        ],
      });

      const diagnosticReport = makeDiagnosticReport({
        code: {
          coding: [
            {
              code: "66666",
              system: "http://www.ama-assn.org/go/cpt",
            },
          ],
        },
        effectiveDateTime: matchingDate,
        identifier: [
          {
            value: "DR123",
            system: "http://example.com/ids",
          },
        ],
      });

      const result = linkProceduresToDiagnosticReports([procedure], [diagnosticReport]);

      expect(result).toBeDefined();
      expect(result[0]).toBeDefined();
      expect(result[0]?.report).toBeUndefined();
    });

    it("should not link when dates are outside the window", () => {
      const notMatchingDate = buildDayjs(
        baseMs + SIZE_OF_WINDOW.asMilliseconds() * 2
      ).toISOString();
      const sharedCode = "55555";

      const procedure = makeProcedure({
        code: {
          coding: [
            {
              code: sharedCode,
              system: "http://www.ama-assn.org/go/cpt",
            },
          ],
        },
        performedDateTime: DATE_TO_MATCH,
        identifier: defaultIdentifier,
      });

      const diagnosticReport = makeDiagnosticReport({
        code: {
          coding: [
            {
              code: sharedCode,
              system: "http://www.ama-assn.org/go/cpt",
            },
          ],
        },
        effectiveDateTime: notMatchingDate,
        identifier: defaultIdentifier,
      });

      const result = linkProceduresToDiagnosticReports([procedure], [diagnosticReport]);

      expect(result).toBeDefined();
      expect(result[0]).toBeDefined();
      expect(result[0]?.report).toBeUndefined();
    });

    it("should link based on identifier values", () => {
      const matchingDate = buildDayjs(baseMs + SIZE_OF_WINDOW.asMilliseconds() / 2).toISOString();
      const sharedIdentifier = "TEST123";

      const procedure = makeProcedure({
        identifier: [
          {
            value: sharedIdentifier,
            system: "http://example.com/ids",
          },
        ],
        performedDateTime: DATE_TO_MATCH,
      });

      const diagnosticReport = makeDiagnosticReport({
        identifier: [
          {
            value: sharedIdentifier,
            system: "http://example.com/ids",
          },
        ],
        effectiveDateTime: matchingDate,
      });

      const result = linkProceduresToDiagnosticReports([procedure], [diagnosticReport]);

      expect(result[0]?.report).toBeDefined();
      expect(result[0]?.report?.[0]?.reference).toBe(`DiagnosticReport/${diagnosticReport.id}`);
    });

    it("should filter out bad identifier values", () => {
      const matchingDate = buildDayjs(baseMs + SIZE_OF_WINDOW.asMilliseconds() / 2).toISOString();

      const procedure = makeProcedure({
        identifier: [
          {
            value: "UNK",
            system: "http://example.com/ids",
          },
        ],
        performedDateTime: DATE_TO_MATCH,
      });

      const diagnosticReport = makeDiagnosticReport({
        identifier: [
          {
            value: "UNK",
            system: "http://example.com/ids",
          },
        ],
        effectiveDateTime: matchingDate,
      });

      const result = linkProceduresToDiagnosticReports([procedure], [diagnosticReport]);

      expect(result).toBeDefined();
      expect(result[0]?.report).toBeUndefined();
    });

    it("should filter out all known useless display values", () => {
      const matchingDate = buildDayjs(baseMs + SIZE_OF_WINDOW.asMilliseconds() / 2).toISOString();
      const uselessValues = ["unknown", "unk", "no known", "no data available"];

      for (const uselessValue of uselessValues) {
        const procedure = makeProcedure({
          identifier: [
            {
              value: uselessValue,
              system: "http://example.com/ids",
            },
          ],
          performedDateTime: DATE_TO_MATCH,
        });

        const diagnosticReport = makeDiagnosticReport({
          identifier: [
            {
              value: uselessValue,
              system: "http://example.com/ids",
            },
          ],
          effectiveDateTime: matchingDate,
        });

        const result = linkProceduresToDiagnosticReports([procedure], [diagnosticReport]);

        expect(result).toBeDefined();
        expect(result[0]?.report).toBeUndefined();
      }
    });

    it("should filter out identifier values with URIs", () => {
      const matchingDate = buildDayjs(baseMs + SIZE_OF_WINDOW.asMilliseconds() / 2).toISOString();

      const procedure = makeProcedure({
        identifier: [
          {
            value: "urn:uuid:12345",
            system: "http://example.com/ids",
          },
        ],
        performedDateTime: DATE_TO_MATCH,
      });

      const diagnosticReport = makeDiagnosticReport({
        identifier: [
          {
            value: "urn:uuid:12345",
            system: "http://example.com/ids",
          },
        ],
        effectiveDateTime: matchingDate,
      });

      const result = linkProceduresToDiagnosticReports([procedure], [diagnosticReport]);

      expect(result[0]?.report).toBeUndefined();
    });

    it("should remove trailing carets from identifier values", () => {
      const matchingDate = buildDayjs(baseMs + SIZE_OF_WINDOW.asMilliseconds() / 2).toISOString();
      const sharedIdentifier = "TEST123";

      const procedure = makeProcedure({
        identifier: [
          {
            value: `${sharedIdentifier}^`,
            system: "http://example.com/ids",
          },
        ],
        performedDateTime: DATE_TO_MATCH,
      });

      const diagnosticReport = makeDiagnosticReport({
        identifier: [
          {
            value: sharedIdentifier,
            system: "http://example.com/ids",
          },
        ],
        effectiveDateTime: matchingDate,
      });

      const result = linkProceduresToDiagnosticReports([procedure], [diagnosticReport]);

      expect(result[0]?.report).toBeDefined();
      expect(result[0]?.report?.[0]?.reference).toBe(`DiagnosticReport/${diagnosticReport.id}`);
    });

    it("should handle multiple matching diagnostic reports and link to all of them", () => {
      const matchingDate = buildDayjs(baseMs + SIZE_OF_WINDOW.asMilliseconds() / 2).toISOString();
      const sharedCode = "55555";

      const procedure = makeProcedure({
        code: {
          coding: [
            {
              code: sharedCode,
              system: "http://www.ama-assn.org/go/cpt",
            },
          ],
        },
        performedDateTime: DATE_TO_MATCH,
        identifier: defaultIdentifier,
      });

      const diagnosticReport1 = makeDiagnosticReport({
        code: {
          coding: [
            {
              code: sharedCode,
              system: "http://www.ama-assn.org/go/cpt",
            },
          ],
        },
        effectiveDateTime: matchingDate,
        identifier: defaultIdentifier,
      });

      const diagnosticReport2 = makeDiagnosticReport({
        code: {
          coding: [
            {
              code: sharedCode,
              system: "http://www.ama-assn.org/go/cpt",
            },
          ],
        },
        effectiveDateTime: matchingDate,
        identifier: defaultIdentifier,
      });

      const result = linkProceduresToDiagnosticReports(
        [procedure],
        [diagnosticReport1, diagnosticReport2]
      );

      expect(result[0]?.report).toBeDefined();
      expect(result[0]?.report).toHaveLength(2);
      expect(result[0]?.report?.[0]?.reference).toBe(`DiagnosticReport/${diagnosticReport1.id}`);
      expect(result[0]?.report?.[1]?.reference).toBe(`DiagnosticReport/${diagnosticReport2.id}`);
    });

    it("should handle procedures with no matching reports", () => {
      const procedure = makeProcedure({
        code: {
          coding: [
            {
              code: "55555",
              system: "http://www.ama-assn.org/go/cpt",
            },
          ],
        },
        performedDateTime: DATE_TO_MATCH,
        identifier: [
          {
            value: "PROC123",
            system: "http://example.com/ids",
          },
        ],
      });

      const diagnosticReport = makeDiagnosticReport({
        code: {
          coding: [
            {
              code: "66666",
              system: "http://www.ama-assn.org/go/cpt",
            },
          ],
        },
        effectiveDateTime: DATE_TO_MATCH,
        identifier: [
          {
            value: "DR123",
            system: "http://example.com/ids",
          },
        ],
      });

      const result = linkProceduresToDiagnosticReports([procedure], [diagnosticReport]);

      expect(result[0]?.report).toBeUndefined();
    });

    it("should comprehensively link multiple procedures to multiple diagnostic reports", () => {
      const baseTime = buildDayjs(DATE_TO_MATCH);
      const withinWindow = baseTime.add(1, "hour").toISOString();
      const outsideWindow = baseTime.add(3, "hours").toISOString();

      const procedure1 = makeProcedure({
        code: {
          coding: [
            {
              code: "12345",
              system: "http://www.ama-assn.org/go/cpt",
            },
          ],
        },
        performedDateTime: DATE_TO_MATCH,
        identifier: [
          {
            value: "PROC001",
            system: "http://example.com/ids",
          },
        ],
      });

      const procedure2 = makeProcedure({
        code: {
          coding: [
            {
              code: "67890",
              system: "http://www.ama-assn.org/go/cpt",
            },
          ],
        },
        performedDateTime: withinWindow,
        identifier: [
          {
            value: "PROC002",
            system: "http://example.com/ids",
          },
        ],
      });

      const procedure3 = makeProcedure({
        code: {
          coding: [
            {
              code: "11111",
              system: "http://www.ama-assn.org/go/cpt",
            },
          ],
        },
        performedDateTime: DATE_TO_MATCH,
        identifier: [
          {
            value: "PROC003",
            system: "http://example.com/ids",
          },
        ],
      });

      const report1 = makeDiagnosticReport({
        code: {
          coding: [
            {
              code: "12345",
              system: "http://www.ama-assn.org/go/cpt",
            },
          ],
        },
        effectiveDateTime: withinWindow,
        identifier: [
          {
            value: "DR001",
            system: "http://example.com/ids",
          },
        ],
      });

      const report2 = makeDiagnosticReport({
        code: {
          coding: [
            {
              code: "67890",
              system: "http://www.ama-assn.org/go/cpt",
            },
          ],
        },
        effectiveDateTime: DATE_TO_MATCH,
        identifier: [
          {
            value: "DR002",
            system: "http://example.com/ids",
          },
        ],
      });

      const report3 = makeDiagnosticReport({
        code: {
          coding: [
            {
              code: "11111",
              system: "http://www.ama-assn.org/go/cpt",
            },
          ],
        },
        effectiveDateTime: outsideWindow,
        identifier: [
          {
            value: "DR003_DIFFERENT",
            system: "http://example.com/ids",
          },
        ],
      });

      const report4 = makeDiagnosticReport({
        code: {
          coding: [
            {
              code: "99999",
              system: "http://www.ama-assn.org/go/cpt",
            },
          ],
        },
        effectiveDateTime: withinWindow,
        identifier: [
          {
            value: "DR004",
            system: "http://example.com/ids",
          },
        ],
      });

      const procedures = [procedure1, procedure2, procedure3];
      const reports = [report1, report2, report3, report4];

      const result = linkProceduresToDiagnosticReports(procedures, reports);

      expect(result).toHaveLength(3);

      expect(result[0]?.report).toBeDefined();
      expect(result[0]?.report).toHaveLength(1);
      expect(result[0]?.report?.[0]?.reference).toBe(`DiagnosticReport/${report1.id}`);

      expect(result[1]?.report).toBeDefined();
      expect(result[1]?.report).toHaveLength(1);
      expect(result[1]?.report?.[0]?.reference).toBe(`DiagnosticReport/${report2.id}`);
      expect(result[2]?.report).toBeUndefined();
    });
  });
});

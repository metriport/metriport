import { buildDayjs } from "@metriport/shared/common/date";
import {
  linkProceduresToDiagnosticReports,
  doDatesMatch,
  THRESHOLD,
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
      const matchingDate = buildDayjs(baseMs + THRESHOLD.asMilliseconds() / 2).toISOString();
      const notMatchingDate = buildDayjs(baseMs + THRESHOLD.asMilliseconds() * 2).toISOString();
      const barelyNotMatchingDate = buildDayjs(
        baseMs + (THRESHOLD.asMilliseconds() + 1)
      ).toISOString();

      const shouldMatch = doDatesMatch([DATE_TO_MATCH], [matchingDate]);
      const shouldNotMatch = doDatesMatch([DATE_TO_MATCH], [notMatchingDate]);
      const barelyNotMatch = doDatesMatch([DATE_TO_MATCH], [barelyNotMatchingDate]);

      expect(shouldMatch).toBe(true);
      expect(shouldNotMatch).toBe(false);
      expect(barelyNotMatch).toBe(false);
    });

    it("should return false when either array is empty", () => {
      expect(doDatesMatch([], [DATE_TO_MATCH])).toBe(false);
      expect(doDatesMatch([DATE_TO_MATCH], [])).toBe(false);
      expect(doDatesMatch([], [])).toBe(false);
    });

    it("should return false when no valid dates are found", () => {
      expect(doDatesMatch(["invalid-date"], ["another-invalid-date"])).toBe(false);
    });

    it("should handle multiple dates in arrays", () => {
      const matchingDate1 = buildDayjs(baseMs + THRESHOLD.asMilliseconds() / 2).toISOString();
      const matchingDate2 = buildDayjs(baseMs + THRESHOLD.asMilliseconds() / 3).toISOString();
      const notMatchingDate = buildDayjs(baseMs + THRESHOLD.asMilliseconds() * 2).toISOString();

      expect(doDatesMatch([DATE_TO_MATCH], [matchingDate1, notMatchingDate])).toBe(true);
      expect(doDatesMatch([DATE_TO_MATCH], [notMatchingDate, matchingDate2])).toBe(true);
    });
  });

  describe("linkProceduresToDiagnosticReports", () => {
    it("should link procedure to diagnostic report when codes match and dates are within window", () => {
      const matchingDate = buildDayjs(baseMs + THRESHOLD.asMilliseconds() / 2).toISOString();
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
      });

      const result = linkProceduresToDiagnosticReports([procedure], [diagnosticReport]);

      expect(result).toBeDefined();
      expect(result[0]).toBeDefined();
      expect(result[0]?.report).toBeDefined();
      expect(result[0]?.report).toHaveLength(1);
      expect(result[0]?.report?.[0]?.reference).toBe(`DiagnosticReport/${diagnosticReport.id}`);
    });

    it("should not link when codes don't match", () => {
      const matchingDate = buildDayjs(baseMs + THRESHOLD.asMilliseconds() / 2).toISOString();

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
      });

      const result = linkProceduresToDiagnosticReports([procedure], [diagnosticReport]);

      expect(result).toBeDefined();
      expect(result[0]).toBeDefined();
      expect(result[0]?.report).toBeUndefined();
    });

    it("should not link when dates are outside the window", () => {
      const notMatchingDate = buildDayjs(baseMs + THRESHOLD.asMilliseconds() * 2).toISOString();
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
      });

      const result = linkProceduresToDiagnosticReports([procedure], [diagnosticReport]);

      expect(result).toBeDefined();
      expect(result[0]).toBeDefined();
      expect(result[0]?.report).toBeUndefined();
    });

    it("should link based on identifier values", () => {
      const matchingDate = buildDayjs(baseMs + THRESHOLD.asMilliseconds() / 2).toISOString();
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

    it("should filter out all known useless display values", () => {
      const matchingDate = buildDayjs(baseMs + THRESHOLD.asMilliseconds() / 2).toISOString();
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

    it("should remove trailing carets from identifier values", () => {
      const matchingDate = buildDayjs(baseMs + THRESHOLD.asMilliseconds() / 2).toISOString();
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
      const matchingDate = buildDayjs(baseMs + THRESHOLD.asMilliseconds() / 2).toISOString();
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
        identifier: defaultIdentifier,
        performedDateTime: DATE_TO_MATCH,
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
      });

      const reportMatchingProcedure1 = makeDiagnosticReport({
        code: {
          coding: [
            {
              code: "12345",
              system: "http://www.ama-assn.org/go/cpt",
            },
          ],
        },
        effectiveDateTime: withinWindow,
      });

      const reportMatchingProcedure2 = makeDiagnosticReport({
        code: {
          coding: [
            {
              code: "67890",
              system: "http://www.ama-assn.org/go/cpt",
            },
          ],
        },
        effectiveDateTime: DATE_TO_MATCH,
      });

      const reportNotMatchingAnyProcedureDate = makeDiagnosticReport({
        code: {
          coding: [
            {
              code: "11111",
              system: "http://www.ama-assn.org/go/cpt",
            },
          ],
        },
        effectiveDateTime: outsideWindow,
      });

      const reportNotMatchingAnyProcedureCode = makeDiagnosticReport({
        code: {
          coding: [
            {
              code: "99999",
              system: "http://www.ama-assn.org/go/cpt",
            },
          ],
        },
        effectiveDateTime: withinWindow,
      });

      const reportMatchingProcedure1ThroughIdentifier = makeDiagnosticReport({
        effectiveDateTime: withinWindow,
        identifier: defaultIdentifier,
      });

      const procedures = [procedure1, procedure2, procedure3];
      const reports = [
        reportMatchingProcedure1,
        reportMatchingProcedure2,
        reportNotMatchingAnyProcedureDate,
        reportNotMatchingAnyProcedureCode,
        reportMatchingProcedure1ThroughIdentifier,
      ];

      const result = linkProceduresToDiagnosticReports(procedures, reports);

      expect(result).toHaveLength(3);

      expect(result[0]?.report).toBeDefined();
      expect(result[0]?.report).toHaveLength(2);

      const reportReferences = result[0]?.report?.map(r => r.reference) ?? [];
      expect(reportReferences).toContain(`DiagnosticReport/${reportMatchingProcedure1.id}`);
      expect(reportReferences).toContain(
        `DiagnosticReport/${reportMatchingProcedure1ThroughIdentifier.id}`
      );

      expect(result[1]?.report).toBeDefined();
      expect(result[1]?.report).toHaveLength(1);
      expect(result[1]?.report?.[0]?.reference).toBe(
        `DiagnosticReport/${reportMatchingProcedure2.id}`
      );

      expect(result[2]?.report).toBeUndefined();
    });
  });
});

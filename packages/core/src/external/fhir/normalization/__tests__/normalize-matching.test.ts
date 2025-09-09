import { buildDayjs } from "@metriport/shared/common/date";
import {
  linkProceduresToDiagnosticReports,
  matchDates,
  SIZE_OF_WINDOW,
} from "../link-procedures-to-reports";
import { makeProcedure } from "../../../../fhir-to-cda/cda-templates/components/__tests__/make-procedure";
import { makeDiagnosticReport } from "../../../../fhir-to-cda/cda-templates/components/__tests__/make-diagnostic-report";

describe("linkProceduresToDiagnosticReports", () => {
  const baseMs = Date.now();
  const DATE_TO_MATCH = buildDayjs(baseMs).toISOString();

  const defaultIdentifier = [
    {
      value: "TEST123",
      system: "http://example.com/ids",
    },
  ];

  beforeAll(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2025-01-02T12:00:00.000Z"));
  });

  afterAll(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  describe("matchDates", () => {
    it("should match based off dates", () => {
      const matchingDate = buildDayjs(baseMs + SIZE_OF_WINDOW / 2).toISOString();
      const notMatchingDate = buildDayjs(baseMs + SIZE_OF_WINDOW * 2).toISOString();
      const barelyNotMatchingDate = buildDayjs(baseMs + (SIZE_OF_WINDOW + 1)).toISOString();

      const shouldMatch = matchDates([DATE_TO_MATCH], [matchingDate]);
      const shouldNotMatch = matchDates([DATE_TO_MATCH], [notMatchingDate]);
      const barelyNotMatch = matchDates([DATE_TO_MATCH], [barelyNotMatchingDate]);

      expect(shouldMatch).toBe(true);
      expect(shouldNotMatch).toBe(false);
      expect(barelyNotMatch).toBe(false);
    });

    it("should return false when either array is empty", () => {
      expect(matchDates([], [DATE_TO_MATCH])).toBe(false);
      expect(matchDates([DATE_TO_MATCH], [])).toBe(false);
      expect(matchDates([], [])).toBe(false);
    });

    it("should return false when no valid dates are found", () => {
      expect(matchDates(["invalid-date"], ["another-invalid-date"])).toBe(false);
    });

    it("should handle multiple dates in arrays", () => {
      const matchingDate1 = buildDayjs(baseMs + SIZE_OF_WINDOW / 2).toISOString();
      const matchingDate2 = buildDayjs(baseMs + SIZE_OF_WINDOW / 3).toISOString();
      const notMatchingDate = buildDayjs(baseMs + SIZE_OF_WINDOW * 2).toISOString();

      expect(matchDates([DATE_TO_MATCH], [matchingDate1, notMatchingDate])).toBe(true);
      expect(matchDates([DATE_TO_MATCH], [notMatchingDate, matchingDate2])).toBe(true);
    });
  });

  describe("linkProceduresToDiagnosticReports", () => {
    it("should link procedure to diagnostic report when codes match and dates are within window", () => {
      const matchingDate = buildDayjs(baseMs + SIZE_OF_WINDOW / 2).toISOString();
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

      expect(result.procedures[0]).toBeDefined();
      expect(result.procedures[0]?.report).toBeDefined();
      expect(result.procedures[0]?.report).toHaveLength(1);
      expect(result.procedures[0]?.report?.[0]?.reference).toBe(
        `DiagnosticReport/${diagnosticReport.id}`
      );
    });

    it("should not link when codes don't match", () => {
      const matchingDate = buildDayjs(baseMs + SIZE_OF_WINDOW / 2).toISOString();

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

      expect(result.procedures[0]).toBeDefined();
      expect(result.procedures[0]?.report).toBeUndefined();
    });

    it("should not link when dates are outside the window", () => {
      const notMatchingDate = buildDayjs(baseMs + SIZE_OF_WINDOW * 2).toISOString();
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

      expect(result.procedures[0]).toBeDefined();
      expect(result.procedures[0]?.report).toBeUndefined();
    });

    it("should link based on identifier values", () => {
      const matchingDate = buildDayjs(baseMs + SIZE_OF_WINDOW / 2).toISOString();
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

      expect(result.procedures[0]?.report).toBeDefined();
      expect(result.procedures[0]?.report?.[0]?.reference).toBe(
        `DiagnosticReport/${diagnosticReport.id}`
      );
    });

    it("should handle identifier values with pipe separators", () => {
      const matchingDate = buildDayjs(baseMs + SIZE_OF_WINDOW / 2).toISOString();
      const sharedIdentifier = "TEST123";

      const procedure = makeProcedure({
        identifier: [
          {
            value: `system1|${sharedIdentifier}`,
            system: "http://example.com/ids",
          },
        ],
        performedDateTime: DATE_TO_MATCH,
      });

      const diagnosticReport = makeDiagnosticReport({
        identifier: [
          {
            value: `system2|${sharedIdentifier}`,
            system: "http://example.com/ids",
          },
        ],
        effectiveDateTime: matchingDate,
      });

      const result = linkProceduresToDiagnosticReports([procedure], [diagnosticReport]);

      expect(result.procedures[0]?.report).toBeDefined();
      expect(result.procedures[0]?.report?.[0]?.reference).toBe(
        `DiagnosticReport/${diagnosticReport.id}`
      );
    });

    it("should match identifier values with dash separators using head-only matching", () => {
      const matchingDate = buildDayjs(baseMs + SIZE_OF_WINDOW / 2).toISOString();

      const procedure = makeProcedure({
        identifier: [
          {
            value: `123-456`,
            system: "http://example.com/ids",
          },
        ],
        performedDateTime: DATE_TO_MATCH,
      });

      const diagnosticReport = makeDiagnosticReport({
        identifier: [
          {
            value: `123-789`,
            system: "http://example.com/ids",
          },
        ],
        effectiveDateTime: matchingDate,
      });

      const result = linkProceduresToDiagnosticReports([procedure], [diagnosticReport]);

      expect(result.procedures[0]?.report).toBeDefined();
      expect(result.procedures[0]?.report?.[0]?.reference).toBe(
        `DiagnosticReport/${diagnosticReport.id}`
      );
    });

    it("should filter out bad identifier values", () => {
      const matchingDate = buildDayjs(baseMs + SIZE_OF_WINDOW / 2).toISOString();

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

      expect(result.procedures[0]).toBeDefined();
      expect(result.procedures[0]?.report).toBeUndefined();
    });

    it("should filter out identifier values with URIs", () => {
      const matchingDate = buildDayjs(baseMs + SIZE_OF_WINDOW / 2).toISOString();

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

      expect(result.procedures[0]?.report).toBeUndefined();
    });

    it("should remove trailing carets from identifier values", () => {
      const matchingDate = buildDayjs(baseMs + SIZE_OF_WINDOW / 2).toISOString();
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

      expect(result.procedures[0]?.report).toBeDefined();
      expect(result.procedures[0]?.report?.[0]?.reference).toBe(
        `DiagnosticReport/${diagnosticReport.id}`
      );
    });

    it("should handle multiple matching diagnostic reports and link to the first one", () => {
      const matchingDate = buildDayjs(baseMs + SIZE_OF_WINDOW / 2).toISOString();
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

      expect(result.procedures[0]?.report).toBeDefined();
      expect(result.procedures[0]?.report).toHaveLength(1);
      // Should link to the first matching report
      expect(result.procedures[0]?.report?.[0]?.reference).toBe(
        `DiagnosticReport/${diagnosticReport1.id}`
      );
    });

    it("should not add duplicate references", () => {
      const matchingDate = buildDayjs(baseMs + SIZE_OF_WINDOW / 2).toISOString();
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
        report: [{ reference: `DiagnosticReport/existing-id` }],
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
        effectiveDateTime: matchingDate,
        identifier: defaultIdentifier,
      });

      const result = linkProceduresToDiagnosticReports([procedure], [diagnosticReport]);

      expect(result.procedures[0]?.report).toBeDefined();
      expect(result.procedures[0]?.report).toHaveLength(2);
      expect(result.procedures[0]?.report?.[0]?.reference).toBe(`DiagnosticReport/existing-id`);
      expect(result.procedures[0]?.report?.[1]?.reference).toBe(
        `DiagnosticReport/${diagnosticReport.id}`
      );
    });

    it("should handle procedures without dates", () => {
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
        // No performedDateTime
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
        effectiveDateTime: DATE_TO_MATCH,
        identifier: defaultIdentifier,
      });

      const result = linkProceduresToDiagnosticReports([procedure], [diagnosticReport]);

      expect(result.procedures[0]?.report).toBeUndefined();
    });

    it("should handle diagnostic reports without dates", () => {
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
        // No effectiveDateTime
        identifier: defaultIdentifier,
      });

      const result = linkProceduresToDiagnosticReports([procedure], [diagnosticReport]);

      expect(result.procedures[0]?.report).toBeUndefined();
    });

    it("should handle empty arrays", () => {
      const result = linkProceduresToDiagnosticReports([], []);

      expect(result.procedures).toEqual([]);
      expect(result.reports).toEqual([]);
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

      expect(result.procedures[0]?.report).toBeUndefined();
    });

    it("should handle diagnostic reports with no matching procedures", () => {
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

      expect(result.reports).toEqual([diagnosticReport]);
    });
  });
});

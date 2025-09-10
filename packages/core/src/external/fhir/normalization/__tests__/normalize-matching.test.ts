import { buildDayjs } from "@metriport/shared/common/date";
import { Procedure } from "@medplum/fhirtypes";
import {
  dangerouslyLinkProceduresToDiagnosticReports,
  doAnyDatesMatchThroughWindow,
  SIZE_OF_WINDOW,
} from "../link-procedures-to-reports";
import { makeProcedure } from "../../../../fhir-to-cda/cda-templates/components/__tests__/make-procedure";
import { makeDiagnosticReport } from "../../../../fhir-to-cda/cda-templates/components/__tests__/make-diagnostic-report";

describe("dangerouslyLinkProceduresToDiagnosticReports", () => {
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
      const matchingDate1 = buildDayjs(baseMs + SIZE_OF_WINDOW / 2).toISOString();
      const matchingDate2 = buildDayjs(baseMs + SIZE_OF_WINDOW / 3).toISOString();
      const notMatchingDate = buildDayjs(baseMs + SIZE_OF_WINDOW * 2).toISOString();

      expect(doAnyDatesMatchThroughWindow([DATE_TO_MATCH], [matchingDate1, notMatchingDate])).toBe(
        true
      );
      expect(doAnyDatesMatchThroughWindow([DATE_TO_MATCH], [notMatchingDate, matchingDate2])).toBe(
        true
      );
    });
  });

  describe("dangerouslyLinkProceduresToDiagnosticReports", () => {
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

      dangerouslyLinkProceduresToDiagnosticReports([procedure], [diagnosticReport]);

      expect(procedure).toBeDefined();
      expect(procedure.report).toBeDefined();
      expect(procedure.report).toHaveLength(1);
      expect(procedure.report?.[0]?.reference).toBe(`DiagnosticReport/${diagnosticReport.id}`);
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

      dangerouslyLinkProceduresToDiagnosticReports([procedure], [diagnosticReport]);

      expect(procedure).toBeDefined();
      expect(procedure.report).toBeUndefined();
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

      dangerouslyLinkProceduresToDiagnosticReports([procedure], [diagnosticReport]);

      expect(procedure).toBeDefined();
      expect(procedure.report).toBeUndefined();
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

      dangerouslyLinkProceduresToDiagnosticReports([procedure], [diagnosticReport]);

      expect(procedure.report).toBeDefined();
      expect(procedure.report?.[0]?.reference).toBe(`DiagnosticReport/${diagnosticReport.id}`);
    });

    it("should match identifier values", () => {
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
            value: `123-456`,
            system: "http://example.com/ids",
          },
        ],
        effectiveDateTime: matchingDate,
      });

      dangerouslyLinkProceduresToDiagnosticReports([procedure], [diagnosticReport]);

      expect(procedure.report).toBeDefined();
      expect(procedure.report?.[0]?.reference).toBe(`DiagnosticReport/${diagnosticReport.id}`);
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

      dangerouslyLinkProceduresToDiagnosticReports([procedure], [diagnosticReport]);

      expect(procedure).toBeDefined();
      expect(procedure.report).toBeUndefined();
    });

    it("should filter out all known useless display values", () => {
      const matchingDate = buildDayjs(baseMs + SIZE_OF_WINDOW / 2).toISOString();
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

        dangerouslyLinkProceduresToDiagnosticReports([procedure], [diagnosticReport]);

        expect(procedure).toBeDefined();
        expect(procedure.report).toBeUndefined();
      }
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

      dangerouslyLinkProceduresToDiagnosticReports([procedure], [diagnosticReport]);

      expect(procedure.report).toBeUndefined();
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

      dangerouslyLinkProceduresToDiagnosticReports([procedure], [diagnosticReport]);

      expect(procedure.report).toBeDefined();
      expect(procedure.report?.[0]?.reference).toBe(`DiagnosticReport/${diagnosticReport.id}`);
    });

    it("should handle multiple matching diagnostic reports and link to all of them", () => {
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

      dangerouslyLinkProceduresToDiagnosticReports(
        [procedure],
        [diagnosticReport1, diagnosticReport2]
      );

      expect(procedure.report).toBeDefined();
      expect(procedure.report).toHaveLength(2);
      // Should link to both matching reports
      expect(procedure.report?.[0]?.reference).toBe(`DiagnosticReport/${diagnosticReport1.id}`);
      expect(procedure.report?.[1]?.reference).toBe(`DiagnosticReport/${diagnosticReport2.id}`);
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

      dangerouslyLinkProceduresToDiagnosticReports([procedure], [diagnosticReport]);

      expect(procedure.report).toBeDefined();
      expect(procedure.report).toHaveLength(2);
      expect(procedure.report?.[0]?.reference).toBe(`DiagnosticReport/existing-id`);
      expect(procedure.report?.[1]?.reference).toBe(`DiagnosticReport/${diagnosticReport.id}`);
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

      dangerouslyLinkProceduresToDiagnosticReports([procedure], [diagnosticReport]);

      expect(procedure.report).toBeUndefined();
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

      dangerouslyLinkProceduresToDiagnosticReports([procedure], [diagnosticReport]);

      expect(procedure.report).toBeUndefined();
    });

    it("should handle empty arrays", () => {
      const procedures: Procedure[] = [];
      dangerouslyLinkProceduresToDiagnosticReports(procedures, []);

      expect(procedures).toEqual([]);
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

      dangerouslyLinkProceduresToDiagnosticReports([procedure], [diagnosticReport]);

      expect(procedure.report).toBeUndefined();
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

      dangerouslyLinkProceduresToDiagnosticReports([procedure], [diagnosticReport]);

      // Reports are not returned since they're not modified
    });

    it("should comprehensively link multiple procedures to multiple diagnostic reports", () => {
      const baseTime = buildDayjs(DATE_TO_MATCH);
      const withinWindow = baseTime.add(1, "hour").toISOString();
      const outsideWindow = baseTime.add(3, "hours").toISOString();

      // Create procedures
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

      // Create diagnostic reports
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
            value: "DR003_DIFFERENT", // Different identifier to avoid identifier-based matching
            system: "http://example.com/ids",
          },
        ],
      });

      const report4 = makeDiagnosticReport({
        code: {
          coding: [
            {
              code: "99999", // Different code, should not match
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

      dangerouslyLinkProceduresToDiagnosticReports(procedures, reports);

      // Verify all procedures are still there
      expect(procedures).toHaveLength(3);

      // Procedure1 should link to Report1 (same code, dates within window)
      expect(procedure1.report).toBeDefined();
      expect(procedure1.report).toHaveLength(1);
      expect(procedure1.report?.[0]?.reference).toBe(`DiagnosticReport/${report1.id}`);

      // Procedure2 should link to Report2 (same code, dates within window)
      expect(procedure2.report).toBeDefined();
      expect(procedure2.report).toHaveLength(1);
      expect(procedure2.report?.[0]?.reference).toBe(`DiagnosticReport/${report2.id}`);

      // Procedure3 should NOT link to Report3 (same code but dates outside window)
      expect(procedure3.report).toBeUndefined();

      // Report4 should remain unlinked (different code)
      // This is verified by the fact that no procedure links to it
    });
  });
});

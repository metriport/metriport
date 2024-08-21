import { faker } from "@faker-js/faker";
import { DiagnosticReport } from "@medplum/fhirtypes";
import {
  makeDiagnosticReport,
  presentedFormExample,
  resultExample,
} from "../../fhir-to-cda/cda-templates/components/__tests__/make-diagnostic-report";
import { groupSameDiagnosticReports } from "../resources/diagnostic-report";
import { dateTime, dateTime2 } from "./examples/condition-examples";

let diagReportId: string;
let diagReportId2: string;
let diagReport: DiagnosticReport;
let diagReport2: DiagnosticReport;

beforeEach(() => {
  diagReportId = faker.string.uuid();
  diagReportId2 = faker.string.uuid();
  diagReport = makeDiagnosticReport({ id: diagReportId });
  diagReport2 = makeDiagnosticReport({ id: diagReportId2 });
});

describe("groupSameDiagnosticReports", () => {
  it("correctly groups duplicate diagReports based on effectiveDateTime and data presence", () => {
    diagReport.effectiveDateTime = dateTime.start;
    diagReport2.effectiveDateTime = dateTime.start;
    diagReport.result = resultExample;
    diagReport2.presentedForm = presentedFormExample;

    const { diagReportsMap } = groupSameDiagnosticReports([diagReport, diagReport2]);
    expect(diagReportsMap.size).toBe(1);
  });

  it("does not group duplicate diagReports if effectiveDateTime is not present", () => {
    diagReport.presentedForm = presentedFormExample;
    diagReport2.presentedForm = presentedFormExample;

    const { diagReportsMap } = groupSameDiagnosticReports([diagReport, diagReport2]);
    expect(diagReportsMap.size).toBe(0);
  });

  it("does not group duplicate diagReports if effectiveDateTime are different", () => {
    diagReport.effectiveDateTime = dateTime.start;
    diagReport2.effectiveDateTime = dateTime2.start;
    const { diagReportsMap } = groupSameDiagnosticReports([diagReport, diagReport2]);
    expect(diagReportsMap.size).toBe(2);
  });

  it("discards codes that don't come from loinc", () => {
    diagReport.effectiveDateTime = dateTime.start;
    diagReport2.effectiveDateTime = dateTime.start;

    diagReport.code = {
      coding: [
        {
          system: "http://loinc.org",
          code: "34109-9",
          display: "Note",
        },
        {
          system: "http://loinc.org",
          code: "11506-3",
          display: "Progress note",
        },
        {
          system: "urn:oid:1.2.840.114350.1.72.727879.69848980",
          code: "1",
          display: "Progress Notes",
        },
      ],
    };

    const { diagReportsMap } = groupSameDiagnosticReports([diagReport, diagReport2]);
    expect(diagReportsMap.size).toBe(1);
    const masterReport = diagReportsMap.values().next().value as DiagnosticReport;

    expect(masterReport.code?.coding?.length).toBe(2);
    expect(masterReport.code?.coding).toEqual(
      expect.not.arrayContaining([
        expect.objectContaining({
          system: expect.stringContaining("urn:oid:1.2.840.114350.1.72.727879.69848980"),
        }),
      ])
    );
  });
});

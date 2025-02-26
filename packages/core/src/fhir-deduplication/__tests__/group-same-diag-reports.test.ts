import { faker } from "@faker-js/faker";
import { DiagnosticReport, Practitioner, Reference } from "@medplum/fhirtypes";
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
let practId: string;
let practId2: string;
let practRef: Reference<Practitioner>;
let practRef2: Reference<Practitioner>;

beforeEach(() => {
  practId = faker.string.uuid();
  practId2 = faker.string.uuid();

  practRef = { reference: `Practitioner/${practId}` };
  practRef2 = { reference: `Practitioner/${practId2}` };

  diagReportId = faker.string.uuid();
  diagReportId2 = faker.string.uuid();
  diagReport = makeDiagnosticReport({ id: diagReportId });
  diagReport2 = makeDiagnosticReport({ id: diagReportId2 });

  delete diagReport.effectiveDateTime;
  delete diagReport.performer;
  delete diagReport.presentedForm;
  delete diagReport.result;

  delete diagReport2.effectiveDateTime;
  delete diagReport2.performer;
  delete diagReport2.presentedForm;
  delete diagReport2.result;
});

describe("groupSameDiagnosticReports", () => {
  it("groups diagReports with the same result", () => {
    diagReport.result = resultExample;
    diagReport2.result = resultExample;

    const { diagReportsMap } = groupSameDiagnosticReports([diagReport, diagReport2]);
    expect(diagReportsMap.size).toBe(1);
  });

  it("groups diagReports with the same result even if one is missing date", () => {
    diagReport.result = resultExample;
    diagReport2.result = resultExample;
    diagReport.effectiveDateTime = dateTime.start;

    const { diagReportsMap } = groupSameDiagnosticReports([diagReport, diagReport2]);
    expect(diagReportsMap.size).toBe(1);
  });

  it("groups diagReports with the same presentedForm", () => {
    diagReport.result = resultExample;
    diagReport2.result = resultExample;

    const { diagReportsMap } = groupSameDiagnosticReports([diagReport, diagReport2]);
    expect(diagReportsMap.size).toBe(1);
  });

  it("groups diagReports with the same effectiveDateTime and performer ref", () => {
    diagReport.effectiveDateTime = dateTime.start;
    diagReport2.effectiveDateTime = dateTime.start;
    diagReport.performer = [practRef];
    diagReport2.performer = [practRef];

    diagReport.result = resultExample;
    diagReport2.presentedForm = presentedFormExample;

    const { diagReportsMap } = groupSameDiagnosticReports([diagReport, diagReport2]);
    expect(diagReportsMap.size).toBe(1);
  });

  it("does not group diagReports with the same effectiveDateTime, if one of them has a performer and the other one does not", () => {
    diagReport.effectiveDateTime = dateTime.start;
    diagReport2.effectiveDateTime = dateTime.start;
    diagReport.performer = [practRef];
    diagReport2.performer = [];

    diagReport.result = resultExample;
    diagReport2.presentedForm = presentedFormExample;

    const { diagReportsMap } = groupSameDiagnosticReports([diagReport, diagReport2]);
    expect(diagReportsMap.size).toBe(2);

    const diagReportIds = Array.from(diagReportsMap.values()).map(d => d.id);
    expect(diagReportIds).toEqual(expect.arrayContaining([diagReport.id, diagReport2.id]));
  });

  it("groups diagReports with the same effectiveDateTime if neither has a practitioner reference", () => {
    diagReport.effectiveDateTime = dateTime.start;
    diagReport2.effectiveDateTime = dateTime.start;

    diagReport.result = resultExample;
    diagReport2.presentedForm = presentedFormExample;

    const { diagReportsMap } = groupSameDiagnosticReports([diagReport, diagReport2]);
    expect(diagReportsMap.size).toBe(1);
  });

  it("does not group diagReports with different performer refs", () => {
    diagReport.effectiveDateTime = dateTime.start;
    diagReport2.effectiveDateTime = dateTime.start;
    diagReport.performer = [practRef];
    diagReport2.performer = [practRef2];

    diagReport.result = resultExample;
    diagReport2.presentedForm = presentedFormExample;

    const { diagReportsMap } = groupSameDiagnosticReports([diagReport, diagReport2]);
    expect(diagReportsMap.size).toBe(2);

    const diagReportIds = Array.from(diagReportsMap.values()).map(d => d.id);
    expect(diagReportIds).toEqual(expect.arrayContaining([diagReport.id, diagReport2.id]));
  });

  it("does not group duplicate diagReports if effectiveDateTime is not present", () => {
    diagReport.presentedForm = presentedFormExample;
    diagReport2.presentedForm = presentedFormExample;

    const { diagReportsMap } = groupSameDiagnosticReports([diagReport, diagReport2]);
    expect(diagReportsMap.size).toBe(1);
  });

  it("does not group duplicate diagReports if effectiveDateTime are different", () => {
    diagReport.effectiveDateTime = dateTime.start;
    diagReport2.effectiveDateTime = dateTime2.start;
    diagReport.presentedForm = presentedFormExample;
    diagReport2.result = resultExample;

    const { diagReportsMap } = groupSameDiagnosticReports([diagReport, diagReport2]);
    expect(diagReportsMap.size).toBe(2);

    const diagReportIds = Array.from(diagReportsMap.values()).map(d => d.id);
    expect(diagReportIds).toEqual(expect.arrayContaining([diagReport.id, diagReport2.id]));
  });

  it("discards diagReport if result and presented form are not present", () => {
    diagReport.effectiveDateTime = dateTime.start;
    diagReport.performer = [practRef];

    const { diagReportsMap } = groupSameDiagnosticReports([diagReport]);
    expect(diagReportsMap.size).toBe(0);
  });

  it("keeps diagReport if result is present and presentedForm is not - without a date", () => {
    diagReport.performer = [practRef];

    diagReport.result = resultExample;

    const { diagReportsMap } = groupSameDiagnosticReports([diagReport]);
    expect(diagReportsMap.size).toBe(1);

    const dedupedDiagReport = diagReportsMap.values().next().value as DiagnosticReport;
    expect(dedupedDiagReport.result).toBeTruthy();
    expect(dedupedDiagReport.presentedForm).toBeFalsy();
  });

  it("keeps diagReport if result is present and presentedForm is not", () => {
    diagReport.effectiveDateTime = dateTime.start;
    diagReport.performer = [practRef];

    diagReport.result = resultExample;

    const { diagReportsMap } = groupSameDiagnosticReports([diagReport]);
    expect(diagReportsMap.size).toBe(1);

    const dedupedDiagReport = diagReportsMap.values().next().value as DiagnosticReport;
    expect(dedupedDiagReport.result).toBeTruthy();
    expect(dedupedDiagReport.presentedForm).toBeFalsy();
  });

  it("keeps diagReport if presentedForm is present and result is not", () => {
    diagReport.effectiveDateTime = dateTime.start;
    diagReport.performer = [practRef];

    diagReport.presentedForm = presentedFormExample;

    const { diagReportsMap } = groupSameDiagnosticReports([diagReport]);
    expect(diagReportsMap.size).toBe(1);

    const dedupedDiagReport = diagReportsMap.values().next().value as DiagnosticReport;
    expect(dedupedDiagReport.presentedForm).toBeTruthy();
    expect(dedupedDiagReport.result).toBeFalsy();
  });

  it("discards codes that don't come from loinc", () => {
    diagReport.effectiveDateTime = dateTime.start;
    diagReport2.effectiveDateTime = dateTime.start;
    diagReport.presentedForm = presentedFormExample;
    diagReport2.presentedForm = presentedFormExample;
    diagReport.performer = [practRef];
    diagReport2.performer = [practRef];

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

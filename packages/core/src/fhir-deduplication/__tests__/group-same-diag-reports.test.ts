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
  diagReport = makeDiagnosticReport({ id: diagReportId, result: resultExample });
  diagReport2 = makeDiagnosticReport({ id: diagReportId2, presentedForm: presentedFormExample });
});

describe("groupSameDiagnosticReports", () => {
  it("groups diagReports with the same effectiveDateTime and performer ref", () => {
    diagReport.effectiveDateTime = dateTime.start;
    diagReport2.effectiveDateTime = dateTime.start;
    diagReport.performer = [practRef];
    diagReport2.performer = [practRef];

    const { diagReportsMap } = groupSameDiagnosticReports([diagReport, diagReport2]);
    expect(diagReportsMap.size).toBe(1);
  });

  it("groups diagReports with the same effectiveDateTime, if one of them has a performer", () => {
    diagReport.effectiveDateTime = dateTime.start;
    diagReport2.effectiveDateTime = dateTime.start;
    diagReport.performer = [practRef];

    const { diagReportsMap } = groupSameDiagnosticReports([diagReport, diagReport2]);
    expect(diagReportsMap.size).toBe(1);
  });

  it("does not group diagReports with the same effectiveDateTime if none of them have a practitioner reference ", () => {
    diagReport.effectiveDateTime = dateTime.start;
    diagReport2.effectiveDateTime = dateTime.start;

    const { diagReportsMap } = groupSameDiagnosticReports([diagReport, diagReport2]);
    expect(diagReportsMap.size).toBe(2);
  });

  it("does not group diagReports with different performer refs", () => {
    diagReport.effectiveDateTime = dateTime.start;
    diagReport2.effectiveDateTime = dateTime.start;
    diagReport.performer = [practRef];
    diagReport2.performer = [practRef2];

    const { diagReportsMap } = groupSameDiagnosticReports([diagReport, diagReport2]);
    expect(diagReportsMap.size).toBe(2);
  });

  it("does not group duplicate diagReports if effectiveDateTime is not present", () => {
    diagReport.presentedForm = presentedFormExample;
    diagReport2.presentedForm = presentedFormExample;

    const { diagReportsMap } = groupSameDiagnosticReports([diagReport, diagReport2]);
    expect(diagReportsMap.size).toBe(2);
  });

  it("does not group duplicate diagReports if effectiveDateTime are different", () => {
    diagReport.effectiveDateTime = dateTime.start;
    diagReport2.effectiveDateTime = dateTime2.start;
    diagReport.presentedForm = presentedFormExample;
    diagReport2.result = resultExample;

    const { diagReportsMap } = groupSameDiagnosticReports([diagReport, diagReport2]);
    expect(diagReportsMap.size).toBe(2);
  });

  it("discards diagReport if result is not present", () => {
    diagReport.effectiveDateTime = dateTime.start;
    diagReport.performer = [practRef];
    delete diagReport.result;
    delete diagReport.presentedForm;

    const { diagReportsMap } = groupSameDiagnosticReports([diagReport]);
    expect(diagReportsMap.size).toBe(0);
  });

  it("keeps diagReport if result is present", () => {
    diagReport.effectiveDateTime = dateTime.start;
    diagReport.performer = [practRef];

    diagReport.result = resultExample;
    delete diagReport.presentedForm;

    const { diagReportsMap } = groupSameDiagnosticReports([diagReport]);
    expect(diagReportsMap.size).toBe(1);
  });

  it("keeps diagReport if presentedForm is present", () => {
    diagReport.effectiveDateTime = dateTime.start;
    diagReport.performer = [practRef];

    diagReport.presentedForm = presentedFormExample;
    delete diagReport.result;

    const { diagReportsMap } = groupSameDiagnosticReports([diagReport]);
    expect(diagReportsMap.size).toBe(1);
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
    console.log("masterReport", JSON.stringify(masterReport));

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

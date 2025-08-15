import { faker } from "@faker-js/faker";
import { DiagnosticReport } from "@medplum/fhirtypes";
import {
  a1cPanelConceptLoinc,
  makeDiagnosticReport,
  metabolicPanelConceptLoinc,
  metabolicPanelConceptOther,
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

  it("groups duplicate diagReports even if effectiveDateTime is not present", () => {
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

    const { diagReportsMap } = groupSameDiagnosticReports([diagReport]);
    expect(diagReportsMap.size).toBe(0);
  });

  it("keeps diagReport if result is present and presentedForm is not - without a date", () => {
    diagReport.result = resultExample;

    const { diagReportsMap } = groupSameDiagnosticReports([diagReport]);
    expect(diagReportsMap.size).toBe(1);

    const dedupedDiagReport = diagReportsMap.values().next().value as DiagnosticReport;
    expect(dedupedDiagReport.result).toBeTruthy();
    expect(dedupedDiagReport.presentedForm).toBeFalsy();
  });

  it("keeps diagReport if result is present and presentedForm is not", () => {
    diagReport.effectiveDateTime = dateTime.start;
    diagReport.result = resultExample;

    const { diagReportsMap } = groupSameDiagnosticReports([diagReport]);
    expect(diagReportsMap.size).toBe(1);

    const dedupedDiagReport = diagReportsMap.values().next().value as DiagnosticReport;
    expect(dedupedDiagReport.result).toBeTruthy();
    expect(dedupedDiagReport.presentedForm).toBeFalsy();
  });

  it("keeps diagReport if presentedForm is present and result is not", () => {
    diagReport.effectiveDateTime = dateTime.start;
    diagReport.presentedForm = presentedFormExample;

    const { diagReportsMap } = groupSameDiagnosticReports([diagReport]);
    expect(diagReportsMap.size).toBe(1);

    const dedupedDiagReport = diagReportsMap.values().next().value as DiagnosticReport;
    expect(dedupedDiagReport.presentedForm).toBeTruthy();
    expect(dedupedDiagReport.result).toBeFalsy();
  });

  it("keeps all codes including non-LOINC ones", () => {
    diagReport.effectiveDateTime = dateTime.start;
    diagReport2.effectiveDateTime = dateTime.start;
    diagReport.presentedForm = presentedFormExample;
    diagReport2.presentedForm = presentedFormExample;

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

    expect(masterReport.code?.coding?.length).toBe(3);
    expect(masterReport.code?.coding).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          system: "http://loinc.org",
          code: "34109-9",
        }),
        expect.objectContaining({
          system: "http://loinc.org",
          code: "11506-3",
        }),
        expect.objectContaining({
          system: "urn:oid:1.2.840.114350.1.72.727879.69848980",
          code: "1",
        }),
      ])
    );
  });

  it("groups lab panel reports with same LOINC codes and datetime", () => {
    diagReport.effectiveDateTime = dateTime.start;
    diagReport2.effectiveDateTime = dateTime.start;

    diagReport.code = a1cPanelConceptLoinc;
    diagReport2.code = a1cPanelConceptLoinc;

    diagReport.result = resultExample;
    diagReport2.presentedForm = presentedFormExample;

    const { diagReportsMap } = groupSameDiagnosticReports([diagReport, diagReport2]);
    expect(diagReportsMap.size).toBe(1);
  });

  it("does not group lab panel reports with same identifiers if the dates are different", () => {
    diagReport.effectiveDateTime = dateTime.start;
    diagReport2.effectiveDateTime = dateTime2.start;

    diagReport.code = a1cPanelConceptLoinc;
    diagReport2.code = a1cPanelConceptLoinc;

    diagReport.result = resultExample;
    diagReport2.presentedForm = presentedFormExample;

    const { diagReportsMap } = groupSameDiagnosticReports([diagReport, diagReport2]);
    expect(diagReportsMap.size).toBe(2);
  });

  it("groups lab panel reports with same display text even if codes differ", () => {
    diagReport.effectiveDateTime = dateTime.start;
    diagReport2.effectiveDateTime = dateTime.start;

    diagReport.code = metabolicPanelConceptLoinc;
    diagReport2.code = metabolicPanelConceptOther;

    diagReport.result = resultExample;
    diagReport2.presentedForm = presentedFormExample;

    const { diagReportsMap } = groupSameDiagnosticReports([diagReport, diagReport2]);
    expect(diagReportsMap.size).toBe(1);
  });

  it("does not group lab panel reports with different LOINC codes even with same datetime", () => {
    diagReport.effectiveDateTime = dateTime.start;
    diagReport2.effectiveDateTime = dateTime.start;

    diagReport.code = metabolicPanelConceptLoinc;
    diagReport2.code = a1cPanelConceptLoinc;

    diagReport.result = resultExample;
    diagReport2.presentedForm = presentedFormExample;

    const { diagReportsMap } = groupSameDiagnosticReports([diagReport, diagReport2]);
    expect(diagReportsMap.size).toBe(2);
  });

  it("groups lab panel reports with same codes but different datetime using date bit logic", () => {
    diagReport.effectiveDateTime = dateTime.start;
    // diagReport2 has no datetime

    diagReport.code = metabolicPanelConceptLoinc;
    diagReport2.code = metabolicPanelConceptOther;

    diagReport.result = resultExample;
    diagReport2.presentedForm = presentedFormExample;

    const { diagReportsMap } = groupSameDiagnosticReports([diagReport, diagReport2]);
    expect(diagReportsMap.size).toBe(1);
  });
});

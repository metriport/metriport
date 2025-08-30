import { faker } from "@faker-js/faker";
import { DiagnosticReport } from "@medplum/fhirtypes";
import {
  makeA1cConcept,
  makeDiagnosticReport,
  makeMetabolicPanelConceptLoinc,
  makeMetabolicPanelConceptOther,
  makePresentedFormExample,
  makePresentedFormExample2,
  makeResultExample,
  makeResultExample2,
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
  delete diagReport.presentedForm;
  delete diagReport.result;
  delete diagReport.code;

  delete diagReport2.effectiveDateTime;
  delete diagReport2.presentedForm;
  delete diagReport2.result;
  delete diagReport2.code;
});

describe("groupSameDiagnosticReports", () => {
  it("discards diagReport if result and presented form are not present", () => {
    const { diagReportsMap } = groupSameDiagnosticReports([diagReport]);
    expect(diagReportsMap.size).toBe(0);
  });

  it("keeps diagReport if result is present and presentedForm is not", () => {
    diagReport.result = makeResultExample();

    const { diagReportsMap } = groupSameDiagnosticReports([diagReport]);
    expect(diagReportsMap.size).toBe(1);

    const dedupedDiagReport = diagReportsMap.values().next().value as DiagnosticReport;
    expect(dedupedDiagReport.result).toBeTruthy();
    expect(dedupedDiagReport.presentedForm).toBeFalsy();
  });

  it("keeps diagReport if presentedForm is present and result is not", () => {
    diagReport.presentedForm = makePresentedFormExample();

    const { diagReportsMap } = groupSameDiagnosticReports([diagReport]);
    expect(diagReportsMap.size).toBe(1);

    const dedupedDiagReport = diagReportsMap.values().next().value as DiagnosticReport;
    expect(dedupedDiagReport.presentedForm).toBeTruthy();
    expect(dedupedDiagReport.result).toBeFalsy();
  });

  it("keeps all codes including non-LOINC ones", () => {
    diagReport.presentedForm = makePresentedFormExample();
    diagReport2.presentedForm = makePresentedFormExample();

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

  // LAB PANEL REPORTS
  it("groups lab panel reports with the same result", () => {
    diagReport.result = makeResultExample();
    diagReport2.result = makeResultExample();

    const { diagReportsMap } = groupSameDiagnosticReports([diagReport, diagReport2]);
    expect(diagReportsMap.size).toBe(1);
  });

  it("groups lab panel reports with the same result even if codes are different", () => {
    diagReport.result = makeResultExample();
    diagReport2.result = makeResultExample();

    diagReport.code = makeA1cConcept();
    diagReport2.code = makeMetabolicPanelConceptLoinc();

    const { diagReportsMap } = groupSameDiagnosticReports([diagReport, diagReport2]);
    expect(diagReportsMap.size).toBe(1);
  });

  it("does not group lab panel reports if codes are different", () => {
    diagReport.result = makeResultExample();
    diagReport2.result = makeResultExample2();

    diagReport.code = makeA1cConcept();
    diagReport2.code = makeMetabolicPanelConceptLoinc();

    const { diagReportsMap } = groupSameDiagnosticReports([diagReport, diagReport2]);
    expect(diagReportsMap.size).toBe(2);

    const diagReportIds = Array.from(diagReportsMap.values()).map(d => d.id);
    expect(diagReportIds).toEqual(expect.arrayContaining([diagReport.id, diagReport2.id]));
  });

  it("does not group lab panel reports if codes are different even with effectiveDateTime the same", () => {
    diagReport.result = makeResultExample();
    diagReport2.result = makeResultExample2();

    diagReport.code = makeA1cConcept();
    diagReport2.code = makeMetabolicPanelConceptLoinc();

    diagReport.effectiveDateTime = dateTime.start;
    diagReport2.effectiveDateTime = dateTime.start;

    const { diagReportsMap } = groupSameDiagnosticReports([diagReport, diagReport2]);
    expect(diagReportsMap.size).toBe(2);

    const diagReportIds = Array.from(diagReportsMap.values()).map(d => d.id);
    expect(diagReportIds).toEqual(expect.arrayContaining([diagReport.id, diagReport2.id]));
  });

  it("does not group lab panel reports if codes are the same and effectiveDateTime are different", () => {
    diagReport.result = makeResultExample();
    diagReport2.result = makeResultExample2();

    diagReport.code = makeA1cConcept();
    diagReport2.code = makeA1cConcept();

    diagReport.effectiveDateTime = dateTime.start;
    diagReport2.effectiveDateTime = dateTime2.start;

    const { diagReportsMap } = groupSameDiagnosticReports([diagReport, diagReport2]);
    expect(diagReportsMap.size).toBe(2);

    const diagReportIds = Array.from(diagReportsMap.values()).map(d => d.id);
    expect(diagReportIds).toEqual(expect.arrayContaining([diagReport.id, diagReport2.id]));
  });

  it("does not group lab panel reports if codes are the same and one of the effectiveDateTime is missing", () => {
    diagReport.result = makeResultExample();
    diagReport2.result = makeResultExample2();

    diagReport.code = makeA1cConcept();
    diagReport2.code = makeA1cConcept();

    diagReport.effectiveDateTime = dateTime.start;

    const { diagReportsMap } = groupSameDiagnosticReports([diagReport, diagReport2]);
    expect(diagReportsMap.size).toBe(2);

    const diagReportIds = Array.from(diagReportsMap.values()).map(d => d.id);
    expect(diagReportIds).toEqual(expect.arrayContaining([diagReport.id, diagReport2.id]));
  });

  it("does not group lab panel reports if codes are the same and both effectiveDateTime are missing", () => {
    diagReport.result = makeResultExample();
    diagReport2.result = makeResultExample2();

    diagReport.code = makeA1cConcept();
    diagReport2.code = makeA1cConcept();

    const { diagReportsMap } = groupSameDiagnosticReports([diagReport, diagReport2]);
    expect(diagReportsMap.size).toBe(2);

    const diagReportIds = Array.from(diagReportsMap.values()).map(d => d.id);
    expect(diagReportIds).toEqual(expect.arrayContaining([diagReport.id, diagReport2.id]));
  });

  it("groups lab panel reports with same LOINC codes and datetime", () => {
    diagReport.result = makeResultExample();
    diagReport2.result = makeResultExample2();

    diagReport.code = makeA1cConcept();
    diagReport2.code = makeA1cConcept();

    diagReport.effectiveDateTime = dateTime.start;
    diagReport2.effectiveDateTime = dateTime.start;

    const { diagReportsMap } = groupSameDiagnosticReports([diagReport, diagReport2]);
    expect(diagReportsMap.size).toBe(1);
  });

  it("groups lab panel reports with same display text even if codes differ", () => {
    diagReport.result = makeResultExample();
    diagReport2.result = makeResultExample2();

    diagReport.code = makeMetabolicPanelConceptLoinc();
    diagReport2.code = makeMetabolicPanelConceptOther();

    diagReport.effectiveDateTime = dateTime.start;
    diagReport2.effectiveDateTime = dateTime.start;

    const { diagReportsMap } = groupSameDiagnosticReports([diagReport, diagReport2]);
    expect(diagReportsMap.size).toBe(1);
  });

  // NOTES
  it("groups notes with the same presentedForm", () => {
    diagReport.presentedForm = makePresentedFormExample();
    diagReport2.presentedForm = makePresentedFormExample();

    const { diagReportsMap } = groupSameDiagnosticReports([diagReport, diagReport2]);
    expect(diagReportsMap.size).toBe(1);
  });

  it("groups notes with the same presentedForm even if codes are different", () => {
    diagReport.presentedForm = makePresentedFormExample();
    diagReport2.presentedForm = makePresentedFormExample();

    // THESE ARE LAB PANEL CODES - USED ONLY FOR UNIT TETSING PURPOSES ON NOTES
    diagReport.code = makeA1cConcept();
    diagReport2.code = makeMetabolicPanelConceptLoinc();

    const { diagReportsMap } = groupSameDiagnosticReports([diagReport, diagReport2]);
    expect(diagReportsMap.size).toBe(1);
  });

  it("does not group notes with the different presentedForm even if codes are the same", () => {
    diagReport.presentedForm = makePresentedFormExample();
    diagReport2.presentedForm = makePresentedFormExample2();

    // THESE ARE LAB PANEL CODES - USED ONLY FOR UNIT TETSING PURPOSES ON NOTES
    diagReport.code = makeA1cConcept();
    diagReport2.code = makeA1cConcept();

    const { diagReportsMap } = groupSameDiagnosticReports([diagReport, diagReport2]);
    expect(diagReportsMap.size).toBe(2);

    const diagReportIds = Array.from(diagReportsMap.values()).map(d => d.id);
    expect(diagReportIds).toEqual(expect.arrayContaining([diagReport.id, diagReport2.id]));
  });
});

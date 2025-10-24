import {
  Observation,
  Condition,
  Procedure,
  Encounter,
  AllergyIntolerance,
  DiagnosticReport,
  MedicationRequest,
  Immunization,
  DocumentReference,
  Composition,
  Coverage,
  Patient,
} from "@medplum/fhirtypes";
import { getClinicalDateRange } from "../clinical-dates";

describe("getClinicalDateRange", () => {
  describe("Observation", () => {
    it("returns effectiveDateTime as primary date", () => {
      const observation: Observation = {
        resourceType: "Observation",
        id: "obs-1",
        status: "final",
        code: { text: "Test" },
        effectiveDateTime: "2023-05-15T10:30:00Z",
        issued: "2023-05-16T08:00:00Z",
      };

      const result = getClinicalDateRange(observation);

      expect(result).toEqual({
        startDate: "2023-05-15T10:30:00Z",
      });
    });

    it("returns effectivePeriod when effectiveDateTime not present", () => {
      const observation: Observation = {
        resourceType: "Observation",
        id: "obs-2",
        status: "final",
        code: { text: "Test" },
        effectivePeriod: {
          start: "2023-05-10T00:00:00Z",
          end: "2023-05-15T00:00:00Z",
        },
        issued: "2023-05-16T08:00:00Z",
      };

      const result = getClinicalDateRange(observation);

      expect(result).toEqual({
        startDate: "2023-05-10T00:00:00Z",
        endDate: "2023-05-15T00:00:00Z",
      });
    });

    it("returns effectivePeriod with only end date", () => {
      const observation: Observation = {
        resourceType: "Observation",
        id: "obs-3",
        status: "final",
        code: { text: "Test" },
        effectivePeriod: {
          end: "2023-05-15T00:00:00Z",
        },
      };

      const result = getClinicalDateRange(observation);

      expect(result).toEqual({
        startDate: "2023-05-15T00:00:00Z",
        endDate: "2023-05-15T00:00:00Z",
      });
    });

    it("returns issued when no effective date", () => {
      const observation: Observation = {
        resourceType: "Observation",
        id: "obs-4",
        status: "final",
        code: { text: "Test" },
        issued: "2023-05-16T08:00:00Z",
      };

      const result = getClinicalDateRange(observation);

      expect(result).toEqual({
        startDate: "2023-05-16T08:00:00Z",
      });
    });

    it("returns undefined when no dates present", () => {
      const observation: Observation = {
        resourceType: "Observation",
        id: "obs-5",
        status: "final",
        code: { text: "Test" },
      };

      const result = getClinicalDateRange(observation);

      expect(result).toBeUndefined();
    });
  });

  describe("Condition", () => {
    it("returns onsetDateTime as primary date", () => {
      const condition: Condition = {
        resourceType: "Condition",
        id: "cond-1",
        subject: { reference: "Patient/1" },
        onsetDateTime: "2023-01-15T00:00:00Z",
        recordedDate: "2023-01-20T00:00:00Z",
      };

      const result = getClinicalDateRange(condition);

      expect(result).toEqual({
        startDate: "2023-01-15T00:00:00Z",
      });
    });

    it("returns onsetPeriod when onsetDateTime not present", () => {
      const condition: Condition = {
        resourceType: "Condition",
        id: "cond-2",
        subject: { reference: "Patient/1" },
        onsetPeriod: {
          start: "2023-01-01T00:00:00Z",
          end: "2023-01-31T00:00:00Z",
        },
      };

      const result = getClinicalDateRange(condition);

      expect(result).toEqual({
        startDate: "2023-01-01T00:00:00Z",
        endDate: "2023-01-31T00:00:00Z",
      });
    });

    it("returns recordedDate as fallback", () => {
      const condition: Condition = {
        resourceType: "Condition",
        id: "cond-3",
        subject: { reference: "Patient/1" },
        recordedDate: "2023-01-20T00:00:00Z",
      };

      const result = getClinicalDateRange(condition);

      expect(result).toEqual({
        startDate: "2023-01-20T00:00:00Z",
      });
    });
  });

  describe("Procedure", () => {
    it("returns performedDateTime as primary date", () => {
      const procedure: Procedure = {
        resourceType: "Procedure",
        id: "proc-1",
        status: "completed",
        subject: { reference: "Patient/1" },
        performedDateTime: "2023-03-10T14:30:00Z",
      };

      const result = getClinicalDateRange(procedure);

      expect(result).toEqual({
        startDate: "2023-03-10T14:30:00Z",
      });
    });

    it("returns performedPeriod when performedDateTime not present", () => {
      const procedure: Procedure = {
        resourceType: "Procedure",
        id: "proc-2",
        status: "completed",
        subject: { reference: "Patient/1" },
        performedPeriod: {
          start: "2023-03-10T14:00:00Z",
          end: "2023-03-10T16:00:00Z",
        },
      };

      const result = getClinicalDateRange(procedure);

      expect(result).toEqual({
        startDate: "2023-03-10T14:00:00Z",
        endDate: "2023-03-10T16:00:00Z",
      });
    });
  });

  describe("Encounter", () => {
    it("returns period as primary date", () => {
      const encounter: Encounter = {
        resourceType: "Encounter",
        id: "enc-1",
        status: "finished",
        class: { code: "AMB" },
        period: {
          start: "2023-04-01T09:00:00Z",
          end: "2023-04-01T10:00:00Z",
        },
      };

      const result = getClinicalDateRange(encounter);

      expect(result).toEqual({
        startDate: "2023-04-01T09:00:00Z",
        endDate: "2023-04-01T10:00:00Z",
      });
    });

    it("returns undefined when no period", () => {
      const encounter: Encounter = {
        resourceType: "Encounter",
        id: "enc-2",
        status: "finished",
        class: { code: "AMB" },
      };

      const result = getClinicalDateRange(encounter);

      expect(result).toBeUndefined();
    });
  });

  describe("AllergyIntolerance", () => {
    it("returns onsetDateTime as primary date", () => {
      const allergy: AllergyIntolerance = {
        resourceType: "AllergyIntolerance",
        id: "allergy-1",
        patient: { reference: "Patient/1" },
        onsetDateTime: "2022-06-15T00:00:00Z",
        recordedDate: "2022-06-20T00:00:00Z",
      };

      const result = getClinicalDateRange(allergy);

      expect(result).toEqual({
        startDate: "2022-06-15T00:00:00Z",
      });
    });
  });

  describe("DiagnosticReport", () => {
    it("returns effectiveDateTime as primary date", () => {
      const report: DiagnosticReport = {
        resourceType: "DiagnosticReport",
        id: "report-1",
        status: "final",
        code: { text: "Lab Report" },
        effectiveDateTime: "2023-07-10T08:00:00Z",
        issued: "2023-07-11T10:00:00Z",
      };

      const result = getClinicalDateRange(report);

      expect(result).toEqual({
        startDate: "2023-07-10T08:00:00Z",
      });
    });
  });

  describe("MedicationRequest", () => {
    it("returns authoredOn as primary date", () => {
      const medRequest: MedicationRequest = {
        resourceType: "MedicationRequest",
        id: "med-1",
        status: "active",
        intent: "order",
        subject: { reference: "Patient/1" },
        authoredOn: "2023-08-05T12:00:00Z",
      };

      const result = getClinicalDateRange(medRequest);

      expect(result).toEqual({
        startDate: "2023-08-05T12:00:00Z",
      });
    });
  });

  describe("Immunization", () => {
    it("returns occurrenceDateTime as primary date", () => {
      const immunization: Immunization = {
        resourceType: "Immunization",
        id: "imm-1",
        status: "completed",
        vaccineCode: { text: "Flu vaccine" },
        patient: { reference: "Patient/1" },
        occurrenceDateTime: "2023-09-15T10:00:00Z",
      };

      const result = getClinicalDateRange(immunization);

      expect(result).toEqual({
        startDate: "2023-09-15T10:00:00Z",
      });
    });

    it("returns recorded when occurrenceDateTime not present", () => {
      const immunization: Immunization = {
        resourceType: "Immunization",
        id: "imm-2",
        status: "completed",
        vaccineCode: { text: "Flu vaccine" },
        patient: { reference: "Patient/1" },
        recorded: "2023-09-16T08:00:00Z",
      };

      const result = getClinicalDateRange(immunization);

      expect(result).toEqual({
        startDate: "2023-09-16T08:00:00Z",
      });
    });
  });

  describe("DocumentReference", () => {
    it("returns date as primary date", () => {
      const doc: DocumentReference = {
        resourceType: "DocumentReference",
        id: "doc-1",
        status: "current",
        content: [],
        date: "2023-10-01T00:00:00Z",
      };

      const result = getClinicalDateRange(doc);

      expect(result).toEqual({
        startDate: "2023-10-01T00:00:00Z",
      });
    });

    it("returns context period when date not present", () => {
      const doc: DocumentReference = {
        resourceType: "DocumentReference",
        id: "doc-2",
        status: "current",
        content: [],
        context: {
          period: {
            start: "2023-09-01T00:00:00Z",
            end: "2023-09-30T00:00:00Z",
          },
        },
      };

      const result = getClinicalDateRange(doc);

      expect(result).toEqual({
        startDate: "2023-09-01T00:00:00Z",
        endDate: "2023-09-30T00:00:00Z",
      });
    });
  });

  describe("Composition", () => {
    it("returns date as primary date", () => {
      const composition: Composition = {
        resourceType: "Composition",
        id: "comp-1",
        status: "final",
        type: { text: "Clinical Note" },
        author: [{ reference: "Practitioner/1" }],
        title: "Note",
        date: "2023-11-01T00:00:00Z",
      };

      const result = getClinicalDateRange(composition);

      expect(result).toEqual({
        startDate: "2023-11-01T00:00:00Z",
      });
    });
  });

  describe("Coverage", () => {
    it("returns period as primary date", () => {
      const coverage: Coverage = {
        resourceType: "Coverage",
        id: "cov-1",
        status: "active",
        beneficiary: { reference: "Patient/1" },
        payor: [{ reference: "Organization/1" }],
        period: {
          start: "2023-01-01T00:00:00Z",
          end: "2023-12-31T23:59:59Z",
        },
      };

      const result = getClinicalDateRange(coverage);

      expect(result).toEqual({
        startDate: "2023-01-01T00:00:00Z",
        endDate: "2023-12-31T23:59:59Z",
      });
    });
  });

  describe("unsupported resource types", () => {
    it("returns undefined for Patient", () => {
      const patient: Patient = {
        resourceType: "Patient",
        id: "pat-1",
      };

      const result = getClinicalDateRange(patient);

      expect(result).toBeUndefined();
    });
  });
});

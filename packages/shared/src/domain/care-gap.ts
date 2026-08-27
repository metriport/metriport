import { BaseDomain, BaseDomainCreate } from "./base-domain";

export interface Coding {
  system: string;
  code: string;
  display?: string;
}

export interface CodeableConcept {
  coding: Coding[];
  text?: string;
}

export interface Reference {
  reference: string;
  display?: string;
}

export interface Period {
  start: string;
  end: string;
}

export interface MeasureReportPopulation {
  code: CodeableConcept;
  count: number;
}

export interface MeasureReportGroup {
  id: string;
  code: CodeableConcept;
  population: MeasureReportPopulation[];
}

export interface MeasureReport {
  resourceType: "MeasureReport";
  id: string;
  status: string;
  type: string;
  measure: string;
  subject: Reference;
  period: Period;
  group: MeasureReportGroup[];
}

export interface CareGapCreate extends Omit<BaseDomainCreate, "id"> {
  cxId: string;
  patientId: string;
  measureName: string;
  jobId: string;
  measureReport: MeasureReport;
  supportingEvidence: Record<string, unknown>;
  lastRun: Date;
}

export interface CareGap extends BaseDomain, CareGapCreate {}

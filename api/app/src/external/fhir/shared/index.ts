import {
  DocumentReference,
  OperationOutcomeIssue,
  ResourceType as MedplumResourceType,
} from "@medplum/fhirtypes";
import { isCommonwellExtension } from "../../commonwell/extension";
import { Operator } from "@medplum/core";

export enum ResourceType {
  Organization = "Organization",
  Patient = "Patient",
  DocumentReference = "DocumentReference",
}

export function operationOutcomeIssueToString(i: OperationOutcomeIssue): string {
  return i.diagnostics ?? i.details?.text ?? i.code ?? "Unknown error";
}

export function downloadedFromCW(doc: DocumentReference): boolean {
  return doc.extension?.some(isCommonwellExtension) ?? false;
}
export function downloadedFromHIEs(doc: DocumentReference): boolean {
  return downloadedFromCW(doc);
}

// Creates a FHIR data query string based on the specified range.
// For example, if dateFrom="2022-03-23" & dateTo="2024-01-02", result will look like:
//  "date=ge2022-03-23&date=le2024-01-02"
export function isoDateRangeToFHIRDateQuery(dateFrom?: string, dateTo?: string): string {
  const fhirDateQueryBase = "date=";
  let fhirDateQuery = `${fhirDateQueryBase}`;
  if (!dateFrom && !dateTo) return "";
  if (dateFrom) fhirDateQuery += `${Operator.GREATER_THAN_OR_EQUALS}${dateFrom}`;
  if (dateTo) {
    fhirDateQuery += `${dateFrom ? `&${fhirDateQueryBase}` : ""}${
      Operator.LESS_THAN_OR_EQUALS
    }${dateTo}`;
  }
  return fhirDateQuery;
}

const resourcesSupportingDateQueriesMap: { [k in MedplumResourceType]?: boolean } = {
  AllergyIntolerance: true,
  CarePlan: true,
  CareTeam: true,
  ClinicalImpression: true,
  Composition: true,
  Consent: true,
  DiagnosticReport: true,
  Encounter: true,
  EpisodeOfCare: true,
  FamilyMemberHistory: true,
  Flag: true,
  Immunization: true,
  List: true,
  Observation: true,
  Procedure: true,
  RiskAssessment: true,
  SupplyRequest: true,
};

export function resourceSupportsDateQuery(resourceType: MedplumResourceType): boolean {
  return Object.keys(resourcesSupportingDateQueriesMap).includes(resourceType);
}

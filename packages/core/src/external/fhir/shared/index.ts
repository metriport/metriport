import { OperationOutcomeError, Operator } from "@medplum/core";
import {
  Bundle,
  Patient,
  Organization,
  Composition,
  Observation,
  DiagnosticReport,
  DocumentReference,
  Extension,
  OperationOutcomeIssue,
  Reference,
  Resource,
  ResourceType as MedplumResourceType,
  Condition,
  Medication,
  MedicationStatement,
} from "@medplum/fhirtypes";
import { isCommonwellExtension } from "../../commonwell/extension";
import { isCarequalityExtension } from "../../carequality/extension";
import { DOC_ID_EXTENSION_URL } from "./extensions/doc-id-extension";
import { isMetriportExtension } from "./extensions/metriport";

export const SEPARATOR_ID = "/";
export const SEPARATOR_REF = "#";

export function operationOutcomeIssueToString(i: OperationOutcomeIssue): string {
  return i.diagnostics ?? i.details?.text ?? i.code ?? "Unknown error";
}

export function getDetailFromOutcomeError(err: OperationOutcomeError): string {
  return err.outcome.issue ? err.outcome.issue.map(operationOutcomeIssueToString).join(";") : "";
}

export function isUploadedByCustomer(doc: DocumentReference): boolean {
  return doc.extension?.some(isMetriportExtension) ?? false;
}
export function downloadedFromCW(doc: DocumentReference): boolean {
  return doc.extension?.some(isCommonwellExtension) ?? false;
}

export function downloadedFromCQ(doc: DocumentReference): boolean {
  return doc.extension?.some(isCarequalityExtension) ?? false;
}

export function downloadedFromHIEs(doc: DocumentReference): boolean {
  return downloadedFromCW(doc) || downloadedFromCQ(doc);
}

// Creates a FHIR data query string based on the specified range.
// For example, if dateFrom="2022-03-23" & dateTo="2024-01-02", result will look like:
//  "date=ge2022-03-23&date=le2024-01-02"
//
// See details here: https://www.hl7.org/fhir/R4/search.html#date
export function isoDateRangeToFHIRDateQuery(dateFrom?: string, dateTo?: string): string {
  const fhirDateQueryBase = "date=";
  let fhirDateQuery = `${fhirDateQueryBase}`;
  if (!dateFrom && !dateTo) return "";
  if (dateFrom) {
    fhirDateQuery += isoDateToFHIRDateQueryFrom(dateFrom);
  }
  if (dateTo) {
    fhirDateQuery += (dateFrom ? `&${fhirDateQueryBase}` : "") + isoDateToFHIRDateQueryTo(dateTo);
  }
  return fhirDateQuery;
}

/**
 * Different from `isoDateRangeToFHIRDateQuery`, this only returns the value,
 * not the whole query param name + value. The return of this function is to
 * be used as value of URLSearchParams.append().
 */
export function isoDateToFHIRDateQueryFrom(dateFrom?: string): string {
  if (!dateFrom) return "";
  return `${Operator.GREATER_THAN_OR_EQUALS}${dateFrom}`;
}

/**
 * Different from `isoDateRangeToFHIRDateQuery`, this only returns the value,
 * not the whole query param name + value. The return of this function is to
 * be used as value of URLSearchParams.append().
 */
export function isoDateToFHIRDateQueryTo(dateTo?: string): string {
  if (!dateTo) return "";
  return `${Operator.LESS_THAN_OR_EQUALS}${dateTo}`;
}

const resourcesSupportingDateQueriesMap: { [k in MedplumResourceType]?: boolean } = {
  Appointment: true,
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

export function isResourceDerivedFromDocRef(resource: Resource, docId: string): boolean {
  if (!("extension" in resource)) return false;
  return (resource.extension ?? [])?.some(e => isExtensionDerivedFromDocRef(e, docId));
}

export function isExtensionDerivedFromDocRef(e: Extension, docId: string): boolean {
  return e.url === DOC_ID_EXTENSION_URL && (e.valueString ?? "")?.includes(docId);
}

/**
 * @see getPatientId() to get the patient ID from a DocumentReference
 */
export function getIdFromSubjectId(subject: Reference | undefined): string | undefined {
  return subject?.id;
}
/**
 * @see getPatientId() to get the patient ID from a DocumentReference
 */
export function getIdFromSubjectRef(subject: Reference | undefined): string | undefined {
  if (subject?.reference) {
    const reference = subject.reference;
    if (reference.includes(SEPARATOR_ID)) return subject.reference.split(SEPARATOR_ID)[1];
    if (reference.includes(SEPARATOR_REF)) return subject.reference.split(SEPARATOR_REF)[1];
  }
  return undefined;
}

function isPatient(resource: Resource | undefined): resource is Patient {
  return resource?.resourceType === "Patient";
}

export function isOrganization(resource: Resource | undefined): resource is Organization {
  return resource?.resourceType === "Organization";
}

export function isComposition(resource: Resource | undefined): resource is Composition {
  return resource?.resourceType === "Composition";
}

export function isObservation(resource: Resource | undefined): resource is Observation {
  return resource?.resourceType === "Observation";
}

export function isDiagnosticReport(resource: Resource | undefined): resource is DiagnosticReport {
  return resource?.resourceType === "DiagnosticReport";
}

export function isCondition(resource: Resource | undefined): resource is Condition {
  return resource?.resourceType === "Condition";
}

export function isMedicationStatement(
  resource: Resource | undefined
): resource is MedicationStatement {
  return resource?.resourceType === "MedicationStatement";
}

export function isMedication(resource: Resource | undefined): resource is Medication {
  return resource?.resourceType === "Medication";
}

export function findOrganizationResource(fhirBundle: Bundle): Organization | undefined {
  return fhirBundle.entry?.map(e => e.resource).find(isOrganization);
}

export function findCompositionResource(fhirBundle: Bundle): Composition | undefined {
  return fhirBundle.entry?.map(e => e.resource).find(isComposition);
}

export function findPatientResource(fhirBundle: Bundle): Patient | undefined {
  return fhirBundle.entry?.map(e => e.resource).find(isPatient);
}

export function findResourceInBundle(bundle: Bundle, reference: string): Resource | undefined {
  if (!bundle.entry) {
    return undefined;
  }
  const entry = bundle.entry.find(entry => {
    const entryReference = entry.resource ? buildEntryReference(entry.resource) : undefined;
    return entryReference === reference;
  });
  return entry?.resource;
}

export function buildEntryReference(resource: Resource): string {
  return `${resource.resourceType}/${resource.id}`;
}

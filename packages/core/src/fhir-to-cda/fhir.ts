import {
  Bundle,
  Composition,
  Condition,
  DiagnosticReport,
  Medication,
  MedicationStatement,
  Observation,
  Organization,
  Patient,
  Resource,
} from "@medplum/fhirtypes";
import { mentalHealthSurveyCodes } from "./cda-templates/constants";

// TODO: Move these to packages/core/src/external/fhir/shared/index.ts
function isPatient(resource: Resource | undefined): resource is Patient {
  return resource?.resourceType === "Patient";
}

function isOrganization(resource: Resource | undefined): resource is Organization {
  return resource?.resourceType === "Organization";
}

export function isCondition(resource: Resource | undefined): resource is Condition {
  return resource?.resourceType === "Condition";
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

export function isMedicationStatement(
  resource: Resource | undefined
): resource is MedicationStatement {
  return resource?.resourceType === "MedicationStatement";
}

export function isMedication(resource: Resource | undefined): resource is Medication {
  return resource?.resourceType === "Medication";
}

export function findOrganizationResource(fhirBundle: Bundle): Organization | undefined {
  const organizationEntry = fhirBundle.entry?.find(entry => isOrganization(entry.resource));
  if (organizationEntry && isOrganization(organizationEntry.resource)) {
    return organizationEntry.resource;
  }
  return undefined;
}

export function findPatientResource(fhirBundle: Bundle): Patient | undefined {
  const patientEntry = fhirBundle.entry?.find(entry => isPatient(entry.resource));
  if (patientEntry && isPatient(patientEntry.resource)) {
    return patientEntry.resource;
  }
  return undefined;
}

export function findResourceInBundle(bundle: Bundle, reference: string): Resource | undefined {
  if (!bundle.entry) {
    return undefined;
  }
  const entry = bundle.entry.find(entry => {
    const entryReference = `${entry.resource?.resourceType}/${entry.resource?.id}`;
    return entryReference === reference;
  });
  return entry?.resource;
}

export function isMentalSurveyObservation(resource: Resource | undefined): resource is Observation {
  if (!isObservation(resource)) {
    return false;
  }

  return resource?.code?.coding?.[0]?.code
    ? mentalHealthSurveyCodes.includes(resource.code.coding[0].code.toLowerCase())
    : false;
}

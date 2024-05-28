import { z } from "zod";

export const resourcesSearchableByPatientSchema = z.enum([
  "Account",
  "AllergyIntolerance",
  "Appointment",
  "AppointmentResponse",
  "AuditEvent",
  "Basic",
  "BodyStructure",
  "CarePlan",
  "CareTeam",
  "ChargeItem",
  "Claim",
  "ClaimResponse",
  "ClinicalImpression",
  "Communication",
  "CommunicationRequest",
  "Composition",
  "Condition",
  "Consent",
  "Contract",
  "Coverage",
  "CoverageEligibilityRequest",
  "CoverageEligibilityResponse",
  "DetectedIssue",
  "Device",
  "DeviceRequest",
  "DeviceUseStatement",
  "DiagnosticReport",
  "DocumentManifest",
  "DocumentReference",
  "Encounter",
  "EnrollmentRequest",
  "EpisodeOfCare",
  "ExplanationOfBenefit",
  "FamilyMemberHistory",
  "Flag",
  "Goal",
  "GuidanceResponse",
  "ImagingStudy",
  "Immunization",
  "ImmunizationEvaluation",
  "ImmunizationRecommendation",
  "Invoice",
  "List",
  "MeasureReport",
  "Media",
  "MedicationAdministration",
  "MedicationDispense",
  "MedicationRequest",
  "MedicationStatement",
  "MolecularSequence",
  "NutritionOrder",
  "Observation",
  "Person",
  "Procedure",
  "Provenance",
  "QuestionnaireResponse",
  "RelatedPerson",
  "RequestGroup",
  "ResearchSubject",
  "RiskAssessment",
  "ServiceRequest",
  "Specimen",
]);
export type ResourceSearchableByPatient = z.infer<typeof resourcesSearchableByPatientSchema>;

export const resourcesSearchableBySubjectSchema = z.enum(["AdverseEvent", "Task"]);
export type ResourceSearchableBySubject = z.infer<typeof resourcesSearchableBySubjectSchema>;

export const generalResourcesSchema = z.enum(["Practitioner"]);
export type GeneralResources = z.infer<typeof generalResourcesSchema>;

export const resourceTypeForConsolidationSchema = z.enum([
  ...resourcesSearchableByPatientSchema.options,
  ...resourcesSearchableBySubjectSchema.options,
  ...generalResourcesSchema.options,
]);
export const resourceSchema = z.array(resourceTypeForConsolidationSchema);

export type ResourceTypeForConsolidation = z.infer<typeof resourceTypeForConsolidationSchema>;

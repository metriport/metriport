import { z } from "zod";

export const consolidatedFilterSchema = z.object({
  resources: z.string(),
  dateFrom: z.date().optional(),
  dateTo: z.date().optional(),
});
export type ConsolidatedFilter = z.infer<typeof consolidatedFilterSchema>;

export const consolidatedCountSchema = z.object({
  total: z.number(),
  resources: z.record(z.number()),
  filter: consolidatedFilterSchema,
});

export type ConsolidatedCountResponse = z.infer<typeof consolidatedCountSchema>;

export const resourcesSearchableByPatient = [
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
] as const;
export type ResourceSearchableByPatient = (typeof resourcesSearchableByPatient)[number];

export const resourcesSearchableBySubject = ["AdverseEvent", "Task"] as const;
export type ResourceSearchableBySubject = (typeof resourcesSearchableBySubject)[number];

export const generalResources = ["Practitioner"] as const;
export type GeneralResources = (typeof generalResources)[number];

export const resourceTypeForConsolidation = [
  ...resourcesSearchableByPatient,
  ...resourcesSearchableBySubject,
  ...generalResources,
] as const;

export type ResourceTypeForConsolidation = (typeof resourceTypeForConsolidation)[number];

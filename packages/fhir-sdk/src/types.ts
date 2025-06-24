import {
  Resource,
  Composition,
  Medication,
  MedicationAdministration,
  MedicationRequest,
  MedicationStatement,
  MedicationDispense,
  DocumentReference,
  Patient,
  Practitioner,
  Organization,
  Condition,
  AllergyIntolerance,
  Encounter,
  DiagnosticReport,
  Immunization,
  Procedure,
  Observation,
  Location,
  RelatedPerson,
  FamilyMemberHistory,
  Coverage,
} from "@medplum/fhirtypes";
import { RESOURCE_TYPES } from "./constants";

export type ResourceTypeIdentifier = (typeof RESOURCE_TYPES)[number];

interface ResourceTypeMapping extends Record<ResourceTypeIdentifier, Resource> {
  Composition: Composition;
  Medication: Medication;
  MedicationAdministration: MedicationAdministration;
  MedicationRequest: MedicationRequest;
  MedicationStatement: MedicationStatement;
  MedicationDispense: MedicationDispense;
  DocumentReference: DocumentReference;
  Patient: Patient;
  Practitioner: Practitioner;
  Organization: Organization;
  Condition: Condition;
  AllergyIntolerance: AllergyIntolerance;
  Encounter: Encounter;
  DiagnosticReport: DiagnosticReport;
  Immunization: Immunization;
  Procedure: Procedure;
  Observation: Observation;
  Location: Location;
  RelatedPerson: RelatedPerson;
  FamilyMemberHistory: FamilyMemberHistory;
  Coverage: Coverage;
}

export type ResourceType<I extends ResourceTypeIdentifier> = ResourceTypeMapping[I];

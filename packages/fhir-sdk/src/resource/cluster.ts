import { ResourceTypeIdentifier } from "../types";
import { PatientCluster } from "./patient/cluster";
import { MedicationCluster } from "./medication/cluster";
import { CompositionCluster } from "./composition/cluster";
import { MedicationAdministrationCluster } from "./medication-administration/cluster";
import { MedicationRequestCluster } from "./medication-request/cluster";
import { MedicationStatementCluster } from "./medication-statement/cluster";
import { MedicationDispenseCluster } from "./medication-dispense/cluster";
import { DocumentReferenceCluster } from "./document-reference/cluster";
import { PractitionerCluster } from "./practitioner/cluster";
import { OrganizationCluster } from "./organization/cluster";
import { ConditionCluster } from "./condition/cluster";
import { AllergyIntoleranceCluster } from "./allergy-intolerance/cluster";
import { EncounterCluster } from "./encounter/cluster";
import { DiagnosticReportCluster } from "./diagnostic-report/cluster";
import { ImmunizationCluster } from "./immunization/cluster";
import { ProcedureCluster } from "./procedure/cluster";
import { ObservationCluster } from "./observation/cluster";
import { LocationCluster } from "./location/cluster";
import { RelatedPersonCluster } from "./related-person/cluster";
import { FamilyMemberHistoryCluster } from "./family-member-history/cluster";
import { CoverageCluster } from "./coverage/cluster";

export const resourceClusterClass: Record<ResourceTypeIdentifier, unknown> = {
  Composition: CompositionCluster,
  Medication: MedicationCluster,
  MedicationAdministration: MedicationAdministrationCluster,
  MedicationRequest: MedicationRequestCluster,
  MedicationStatement: MedicationStatementCluster,
  MedicationDispense: MedicationDispenseCluster,
  DocumentReference: DocumentReferenceCluster,
  Patient: PatientCluster,
  Practitioner: PractitionerCluster,
  Organization: OrganizationCluster,
  Condition: ConditionCluster,
  AllergyIntolerance: AllergyIntoleranceCluster,
  Encounter: EncounterCluster,
  DiagnosticReport: DiagnosticReportCluster,
  Immunization: ImmunizationCluster,
  Procedure: ProcedureCluster,
  Observation: ObservationCluster,
  Location: LocationCluster,
  RelatedPerson: RelatedPersonCluster,
  FamilyMemberHistory: FamilyMemberHistoryCluster,
  Coverage: CoverageCluster,
};

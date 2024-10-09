import { Patient, Reference, Resource } from "@medplum/fhirtypes";
import { isReferenceOfType } from "../shared/references";

/**
 * Returns the Patient references from the given resources.
 *
 * @param resources Array of Resource to search for Patient references.
 * @returns Array of Reference<Patient>
 * @see https://www.hl7.org/fhir/r4/patient.html ("This resource is referenced by...")
 */
export function getPatientReferencesFromResources(resources: Resource[]): Reference<Patient>[] {
  const references: Reference<Patient>[] = [];
  for (const resource of resources) {
    if (resource.resourceType === "AdverseEvent") {
      if (resource.subject && isPatientReference(resource.subject)) {
        references.push(resource.subject);
      }
      if (resource.recorder && isPatientReference(resource.recorder)) {
        references.push(resource.recorder);
      }
      continue;
    }
    if (resource.resourceType === "AllergyIntolerance") {
      if (resource.patient && isPatientReference(resource.patient)) {
        references.push(resource.patient);
      }
      if (resource.recorder && isPatientReference(resource.recorder)) {
        references.push(resource.recorder);
      }
      if (resource.asserter && isPatientReference(resource.asserter)) {
        references.push(resource.asserter);
      }
      continue;
    }
    if (resource.resourceType === "Appointment") {
      if (resource.participant) {
        references.push(
          ...resource.participant.flatMap(p => p.actor ?? []).filter(isPatientReference)
        );
      }
      continue;
    }
    if (resource.resourceType === "AppointmentResponse") {
      if (resource.actor && isPatientReference(resource.actor)) {
        references.push(resource.actor);
      }
      continue;
    }
    if (resource.resourceType === "AuditEvent") {
      if (resource.agent) {
        references.push(...resource.agent.flatMap(p => p.who ?? []).filter(isPatientReference));
      }
      if (resource.source?.observer && isPatientReference(resource.source.observer)) {
        references.push(resource.source.observer);
      }
      continue;
    }
    if (resource.resourceType === "Basic") {
      if (resource.author && isPatientReference(resource.author)) {
        references.push(resource.author);
      }
      continue;
    }
    if (resource.resourceType === "BiologicallyDerivedProduct") {
      if (resource.collection?.source && isPatientReference(resource.collection.source)) {
        references.push(resource.collection.source);
      }
      continue;
    }
    if (resource.resourceType === "BodyStructure") {
      if (resource.patient) references.push(resource.patient);
      continue;
    }
    if (resource.resourceType === "CarePlan") {
      if (resource.subject && isPatientReference(resource.subject)) {
        references.push(resource.subject);
      }
      if (resource.author && isPatientReference(resource.author)) {
        references.push(resource.author);
      }
      if (resource.contributor) {
        references.push(...resource.contributor.filter(isPatientReference));
      }
      if (resource.activity) {
        references.push(
          ...resource.activity.flatMap(p => p.detail?.performer ?? []).filter(isPatientReference)
        );
      }
      continue;
    }
    if (resource.resourceType === "CareTeam") {
      if (resource.subject && isPatientReference(resource.subject)) {
        references.push(resource.subject);
      }
      if (resource.participant) {
        references.push(
          ...resource.participant.flatMap(p => p.member ?? []).filter(isPatientReference)
        );
      }
      continue;
    }
    if (resource.resourceType === "ChargeItem") {
      if (resource.subject && isPatientReference(resource.subject)) {
        references.push(resource.subject);
      }
      if (resource.performer) {
        references.push(
          ...resource.performer.flatMap(p => p.actor ?? []).filter(isPatientReference)
        );
      }
      if (resource.enterer && isPatientReference(resource.enterer)) {
        references.push(resource.enterer);
      }
      continue;
    }
    if (resource.resourceType === "Claim") {
      if (resource.patient) references.push(resource.patient);
      if (resource.payee?.party && isPatientReference(resource.payee.party)) {
        references.push(resource.payee.party);
      }
      continue;
    }
    if (resource.resourceType === "ClaimResponse") {
      if (resource.patient) references.push(resource.patient);
      continue;
    }
    if (resource.resourceType === "ClinicalImpression") {
      if (resource.subject && isPatientReference(resource.subject)) {
        references.push(resource.subject);
      }
      continue;
    }
    if (resource.resourceType === "Communication") {
      if (resource.subject && isPatientReference(resource.subject)) {
        references.push(resource.subject);
      }
      if (resource.recipient) {
        references.push(...resource.recipient.filter(isPatientReference));
      }
      if (resource.sender && isPatientReference(resource.sender)) {
        references.push(resource.sender);
      }
      continue;
    }
    if (resource.resourceType === "CommunicationRequest") {
      if (resource.subject && isPatientReference(resource.subject)) {
        references.push(resource.subject);
      }
      if (resource.recipient) {
        references.push(...resource.recipient.filter(isPatientReference));
      }
      if (resource.requester && isPatientReference(resource.requester)) {
        references.push(resource.requester);
      }
      if (resource.sender && isPatientReference(resource.sender)) {
        references.push(resource.sender);
      }
      continue;
    }
    if (resource.resourceType === "Composition") {
      if (resource.author) {
        references.push(...resource.author.filter(isPatientReference));
      }
      if (resource.attester) {
        references.push(
          ...resource.attester.flatMap(p => p.party ?? []).filter(isPatientReference)
        );
      }
      if (resource.section) {
        references.push(
          ...resource.section.flatMap(p => p.author ?? []).filter(isPatientReference)
        );
      }
      continue;
    }
    if (resource.resourceType === "Condition") {
      if (resource.subject && isPatientReference(resource.subject)) {
        references.push(resource.subject);
      }
      if (resource.asserter && isPatientReference(resource.asserter)) {
        references.push(resource.asserter);
      }
      if (resource.recorder && isPatientReference(resource.recorder)) {
        references.push(resource.recorder);
      }
      continue;
    }
    if (resource.resourceType === "Consent") {
      if (resource.patient && isPatientReference(resource.patient)) {
        references.push(resource.patient);
      }
      if (resource.performer) {
        references.push(...resource.performer.filter(isPatientReference));
      }
      if (resource.verification) {
        references.push(
          ...resource.verification.flatMap(p => p.verifiedWith ?? []).filter(isPatientReference)
        );
      }
      continue;
    }
    if (resource.resourceType === "Contract") {
      if (resource.subject) {
        references.push(...resource.subject.filter(isPatientReference));
      }
      if (resource.author && isPatientReference(resource.author)) {
        references.push(resource.author);
      }
      if (resource.term) {
        references.push(
          ...resource.term
            .flatMap(t => t.offer?.party ?? [])
            .flatMap(p => p.reference ?? [])
            .filter(isPatientReference)
        );
        const valuedItem = resource.term
          .flatMap(t => t.asset ?? [])
          .flatMap(a => a.valuedItem ?? []);
        references.push(...valuedItem.flatMap(i => i.responsible ?? []).filter(isPatientReference));
        references.push(...valuedItem.flatMap(i => i.recipient ?? []).filter(isPatientReference));

        const actions = resource.term.flatMap(t => t.action ?? []);
        references.push(
          ...actions
            .flatMap(a => a.subject ?? [])
            .flatMap(s => s.reference ?? [])
            .filter(isPatientReference)
        );
        references.push(...actions.flatMap(a => a.requester ?? []).filter(isPatientReference));
        references.push(...actions.flatMap(a => a.performer ?? []).filter(isPatientReference));
      }
      if (resource.signer) {
        references.push(...resource.signer.flatMap(p => p.party ?? []).filter(isPatientReference));
      }
      continue;
    }
    if (resource.resourceType === "Coverage") {
      if (resource.beneficiary && isPatientReference(resource.beneficiary)) {
        references.push(resource.beneficiary);
      }
      if (resource.subscriber && isPatientReference(resource.subscriber)) {
        references.push(resource.subscriber);
      }
      if (resource.policyHolder && isPatientReference(resource.policyHolder)) {
        references.push(resource.policyHolder);
      }
      if (resource.payor) {
        references.push(...resource.payor.filter(isPatientReference));
      }
      continue;
    }
    if (resource.resourceType === "CoverageEligibilityRequest") {
      if (resource.patient) references.push(resource.patient);
      continue;
    }
    if (resource.resourceType === "CoverageEligibilityResponse") {
      if (resource.patient) references.push(resource.patient);
      continue;
    }
    if (resource.resourceType === "DetectedIssue") {
      if (resource.patient) references.push(resource.patient);
      continue;
    }
    if (resource.resourceType === "Device") {
      if (resource.patient) references.push(resource.patient);
      continue;
    }
    if (resource.resourceType === "DeviceRequest") {
      if (resource.subject && isPatientReference(resource.subject)) {
        references.push(resource.subject);
      }
      if (resource.performer && isPatientReference(resource.performer)) {
        references.push(resource.performer);
      }
      continue;
    }
    if (resource.resourceType === "DeviceUseStatement") {
      if (resource.subject && isPatientReference(resource.subject)) {
        references.push(resource.subject);
      }
      if (resource.source && isPatientReference(resource.source)) {
        references.push(resource.source);
      }
      continue;
    }
    if (resource.resourceType === "DiagnosticReport") {
      if (resource.subject && isPatientReference(resource.subject)) {
        references.push(resource.subject);
      }
      continue;
    }
    if (resource.resourceType === "DocumentManifest") {
      if (resource.subject && isPatientReference(resource.subject)) {
        references.push(resource.subject);
      }
      if (resource.author) {
        references.push(...resource.author.filter(isPatientReference));
      }
      if (resource.recipient) {
        references.push(...resource.recipient.filter(isPatientReference));
      }
      if (resource.related) {
        references.push(...resource.related.flatMap(r => r.ref ?? []).filter(isPatientReference));
      }
      continue;
    }
    if (resource.resourceType === "DocumentReference") {
      if (resource.subject && isPatientReference(resource.subject)) {
        references.push(resource.subject);
      }
      if (resource.author) {
        references.push(...resource.author.filter(isPatientReference));
      }
      if (resource.context) {
        const context = resource.context;
        if (context.sourcePatientInfo && isPatientReference(context.sourcePatientInfo)) {
          references.push(context.sourcePatientInfo);
        }
        if (context.related) {
          references.push(...context.related.filter(isPatientReference));
        }
      }
      continue;
    }
    if (resource.resourceType === "Encounter") {
      if (resource.subject && isPatientReference(resource.subject)) {
        references.push(resource.subject);
      }
      continue;
    }
    if (resource.resourceType === "EnrollmentRequest") {
      if (resource.candidate) references.push(resource.candidate);
      continue;
    }
    if (resource.resourceType === "EpisodeOfCare") {
      if (resource.patient) references.push(resource.patient);
      continue;
    }
    if (resource.resourceType === "ExplanationOfBenefit") {
      if (resource.patient) references.push(resource.patient);
      if (resource.payee?.party && isPatientReference(resource.payee.party)) {
        references.push(resource.payee.party);
      }
      continue;
    }
    if (resource.resourceType === "FamilyMemberHistory") {
      if (resource.patient) references.push(resource.patient);
      continue;
    }
    if (resource.resourceType === "Flag") {
      if (resource.subject && isPatientReference(resource.subject)) {
        references.push(resource.subject);
      }
      if (resource.author && isPatientReference(resource.author)) {
        references.push(resource.author);
      }
      continue;
    }
    if (resource.resourceType === "Goal") {
      if (resource.subject && isPatientReference(resource.subject)) {
        references.push(resource.subject);
      }
      if (resource.expressedBy && isPatientReference(resource.expressedBy)) {
        references.push(resource.expressedBy);
      }
      continue;
    }
    if (resource.resourceType === "Group") {
      if (resource.member) {
        references.push(...resource.member.flatMap(m => m.entity ?? []).filter(isPatientReference));
      }
      continue;
    }
    if (resource.resourceType === "GuidanceResponse") {
      if (resource.subject && isPatientReference(resource.subject)) {
        references.push(resource.subject);
      }
      continue;
    }
    if (resource.resourceType === "ImagingStudy") {
      if (resource.subject && isPatientReference(resource.subject)) {
        references.push(resource.subject);
      }
      if (resource.series) {
        references.push(
          ...resource.series
            .flatMap(p => p.performer ?? [])
            .flatMap(p => p.actor ?? [])
            .filter(isPatientReference)
        );
      }
      continue;
    }
    if (resource.resourceType === "Immunization") {
      if (resource.patient) references.push(resource.patient);
      continue;
    }
    if (resource.resourceType === "ImmunizationEvaluation") {
      if (resource.patient) references.push(resource.patient);
      continue;
    }
    if (resource.resourceType === "ImmunizationRecommendation") {
      if (resource.patient) references.push(resource.patient);
      continue;
    }
    if (resource.resourceType === "Invoice") {
      if (resource.subject && isPatientReference(resource.subject)) {
        references.push(resource.subject);
      }
      if (resource.recipient && isPatientReference(resource.recipient)) {
        references.push(resource.recipient);
      }
      if (resource.participant) {
        references.push(
          ...resource.participant.flatMap(p => p.actor ?? []).filter(isPatientReference)
        );
      }
      continue;
    }
    if (resource.resourceType === "List") {
      if (resource.subject && isPatientReference(resource.subject)) {
        references.push(resource.subject);
      }
      if (resource.source && isPatientReference(resource.source)) {
        references.push(resource.source);
      }
      if (resource.entry) {
        references.push(...resource.entry.flatMap(p => p.item ?? []).filter(isPatientReference));
      }
      continue;
    }
    if (resource.resourceType === "MeasureReport") {
      if (resource.subject && isPatientReference(resource.subject)) {
        references.push(resource.subject);
      }
      if (resource.evaluatedResource) {
        references.push(...resource.evaluatedResource.filter(isPatientReference));
      }
      continue;
    }
    if (resource.resourceType === "Media") {
      if (resource.subject && isPatientReference(resource.subject)) {
        references.push(resource.subject);
      }
      if (resource.operator && isPatientReference(resource.operator)) {
        references.push(resource.operator);
      }
      continue;
    }
    if (resource.resourceType === "MedicationAdministration") {
      if (resource.subject && isPatientReference(resource.subject)) {
        references.push(resource.subject);
      }
      if (resource.performer) {
        references.push(
          ...resource.performer.flatMap(p => p.actor ?? []).filter(isPatientReference)
        );
      }
      continue;
    }
    if (resource.resourceType === "MedicationDispense") {
      if (resource.subject && isPatientReference(resource.subject)) {
        references.push(resource.subject);
      }
      if (resource.receiver) {
        references.push(...resource.receiver.filter(isPatientReference));
      }
      if (resource.performer) {
        references.push(
          ...resource.performer.flatMap(p => p.actor ?? []).filter(isPatientReference)
        );
      }
      continue;
    }
    if (resource.resourceType === "MedicationRequest") {
      if (resource.subject && isPatientReference(resource.subject)) {
        references.push(resource.subject);
      }
      if (resource.performer && isPatientReference(resource.performer)) {
        references.push(resource.performer);
      }
      if (resource.requester && isPatientReference(resource.requester)) {
        references.push(resource.requester);
      }
      if (resource.reportedReference && isPatientReference(resource.reportedReference)) {
        references.push(resource.reportedReference);
      }
      if (resource.supportingInformation) {
        references.push(...resource.supportingInformation.filter(isPatientReference));
      }
      continue;
    }
    if (resource.resourceType === "MedicationStatement") {
      if (resource.subject && isPatientReference(resource.subject)) {
        references.push(resource.subject);
      }
      if (resource.informationSource && isPatientReference(resource.informationSource)) {
        references.push(resource.informationSource);
      }
      if (resource.derivedFrom) {
        references.push(...resource.derivedFrom.filter(isPatientReference));
      }
      continue;
    }
    if (resource.resourceType === "MolecularSequence") {
      if (resource.patient) references.push(resource.patient);
      continue;
    }
    if (resource.resourceType === "NutritionOrder") {
      if (resource.patient) references.push(resource.patient);
      continue;
    }
    if (resource.resourceType === "Observation") {
      if (resource.subject && isPatientReference(resource.subject)) {
        references.push(resource.subject);
      }
      if (resource.focus) {
        references.push(...resource.focus.filter(isPatientReference));
      }
      if (resource.performer) {
        references.push(...resource.performer.filter(isPatientReference));
      }
      continue;
    }
    if (resource.resourceType === "Person") {
      if (resource.link) {
        references.push(...resource.link.flatMap(p => p.target ?? []).filter(isPatientReference));
      }
      continue;
    }
    if (resource.resourceType === "Procedure") {
      if (resource.subject && isPatientReference(resource.subject)) {
        references.push(resource.subject);
      }
      if (resource.asserter && isPatientReference(resource.asserter)) {
        references.push(resource.asserter);
      }
      if (resource.recorder && isPatientReference(resource.recorder)) {
        references.push(resource.recorder);
      }
      if (resource.performer) {
        references.push(
          ...resource.performer.flatMap(p => p.actor ?? []).filter(isPatientReference)
        );
      }
      continue;
    }
    if (resource.resourceType === "Provenance") {
      if (resource.target) {
        references.push(...resource.target.filter(isPatientReference));
      }
      if (resource.agent) {
        references.push(...resource.agent.flatMap(p => p.who ?? []).filter(isPatientReference));
        references.push(
          ...resource.agent.flatMap(p => p.onBehalfOf ?? []).filter(isPatientReference)
        );
      }
      if (resource.entity) {
        references.push(...resource.entity.flatMap(p => p.what ?? []).filter(isPatientReference));
      }
      continue;
    }
    if (resource.resourceType === "QuestionnaireResponse") {
      if (resource.subject && isPatientReference(resource.subject)) {
        references.push(resource.subject);
      }
      if (resource.author && isPatientReference(resource.author)) {
        references.push(resource.author);
      }
      if (resource.source && isPatientReference(resource.source)) {
        references.push(resource.source);
      }
      continue;
    }
    if (resource.resourceType === "RelatedPerson") {
      if (resource.patient) references.push(resource.patient);
      continue;
    }
    if (resource.resourceType === "RequestGroup") {
      if (resource.subject && isPatientReference(resource.subject)) {
        references.push(resource.subject);
      }
      if (resource.action) {
        references.push(
          ...resource.action.flatMap(p => p.participant ?? []).filter(isPatientReference)
        );
        references.push(
          ...resource.action.flatMap(p => p.resource ?? []).filter(isPatientReference)
        );
      }
      continue;
    }
    if (resource.resourceType === "ResearchSubject") {
      if (resource.individual) references.push(resource.individual);
      continue;
    }
    if (resource.resourceType === "RiskAssessment") {
      if (resource.subject && isPatientReference(resource.subject)) {
        references.push(resource.subject);
      }
      if (resource.basis) {
        references.push(...resource.basis.filter(isPatientReference));
      }
      continue;
    }
    if (resource.resourceType === "Schedule") {
      if (resource.actor) {
        references.push(...resource.actor.filter(isPatientReference));
      }
      continue;
    }
    if (resource.resourceType === "ServiceRequest") {
      if (resource.subject && isPatientReference(resource.subject)) {
        references.push(resource.subject);
      }
      if (resource.requester && isPatientReference(resource.requester)) {
        references.push(resource.requester);
      }
      if (resource.performer) {
        references.push(...resource.performer.filter(isPatientReference));
      }
      if (resource.supportingInfo) {
        references.push(...resource.supportingInfo.filter(isPatientReference));
      }
      continue;
    }
    if (resource.resourceType === "Specimen") {
      if (resource.subject && isPatientReference(resource.subject)) {
        references.push(resource.subject);
      }
      continue;
    }
    if (resource.resourceType === "SupplyDelivery") {
      if (resource.patient) references.push(resource.patient);
      continue;
    }
    if (resource.resourceType === "SupplyRequest") {
      if (resource.requester && isPatientReference(resource.requester)) {
        references.push(resource.requester);
      }
      if (resource.deliverTo && isPatientReference(resource.deliverTo)) {
        references.push(resource.deliverTo);
      }
      continue;
    }
    if (resource.resourceType === "Task") {
      if (resource.focus && isPatientReference(resource.focus)) {
        references.push(resource.focus);
      }
      if (resource.for && isPatientReference(resource.for)) {
        references.push(resource.for);
      }
      if (resource.requester && isPatientReference(resource.requester)) {
        references.push(resource.requester);
      }
      if (resource.owner && isPatientReference(resource.owner)) {
        references.push(resource.owner);
      }
      if (resource.reasonReference && isPatientReference(resource.reasonReference)) {
        references.push(resource.reasonReference);
      }
      if (resource.restriction) {
        references.push(...(resource.restriction.recipient ?? []).filter(isPatientReference));
      }
      continue;
    }
    if (resource.resourceType === "VisionPrescription") {
      if (resource.patient) references.push(resource.patient);
      continue;
    }
  }
  return references;
}

export function isPatientReference(ref: Reference): ref is Reference<Patient> {
  return isReferenceOfType(ref, "Patient");
}

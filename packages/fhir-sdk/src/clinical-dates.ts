import {
  Resource,
  AdverseEvent,
  AllergyIntolerance,
  Appointment,
  BiologicallyDerivedProduct,
  CarePlan,
  CareTeam,
  ChargeItem,
  Claim,
  ClinicalImpression,
  Communication,
  CommunicationRequest,
  Composition,
  Condition,
  Consent,
  Coverage,
  DeviceRequest,
  DeviceUseStatement,
  DiagnosticReport,
  DocumentReference,
  Encounter,
  EpisodeOfCare,
  ExplanationOfBenefit,
  FamilyMemberHistory,
  Flag,
  Goal,
  ImagingStudy,
  Immunization,
  Invoice,
  List,
  Media,
  MedicationAdministration,
  MedicationDispense,
  MedicationRequest,
  MedicationStatement,
  NutritionOrder,
  Observation,
  Procedure,
  Provenance,
  QuestionnaireResponse,
  RequestGroup,
  RiskAssessment,
  ServiceRequest,
  Specimen,
  SupplyDelivery,
  SupplyRequest,
  Task,
  VisionPrescription,
} from "@medplum/fhirtypes";

/**
 * Date range extracted from a FHIR resource for use with searchByDateRange()
 */
export interface ResourceDateRange {
  /** The start date in ISO format */
  startDate: string;
  /** The end date in ISO format (only present for period-based dates) */
  endDate?: string;
}

/**
 * Extract the primary clinical date range from a FHIR resource.
 * Returns undefined if the resource has no clinical dates.
 *
 * The returned dates can be passed directly to searchByDateRange():
 * @example
 * const dateRange = getClinicalDateRange(myObservation);
 * if (dateRange) {
 *   bundle.searchByDateRange({
 *     dateFrom: dateRange.startDate,
 *     dateTo: dateRange.endDate
 *   });
 * }
 */
export function getClinicalDateRange(resource: Resource): ResourceDateRange | undefined {
  switch (resource.resourceType) {
    case "AllergyIntolerance": {
      const r = resource as AllergyIntolerance;
      if (r.onsetDateTime) {
        return { startDate: r.onsetDateTime };
      }
      if (r.onsetPeriod?.start || r.onsetPeriod?.end) {
        const startDate = r.onsetPeriod.start ?? r.onsetPeriod.end ?? "";
        return r.onsetPeriod.end ? { startDate, endDate: r.onsetPeriod.end } : { startDate };
      }
      if (r.lastOccurrence) {
        return { startDate: r.lastOccurrence };
      }
      if (r.recordedDate) {
        return { startDate: r.recordedDate };
      }
      break;
    }
    case "Condition": {
      const r = resource as Condition;
      if (r.onsetDateTime) {
        return { startDate: r.onsetDateTime };
      }
      if (r.onsetPeriod?.start || r.onsetPeriod?.end) {
        const startDate = r.onsetPeriod.start ?? r.onsetPeriod.end ?? "";
        return r.onsetPeriod.end ? { startDate, endDate: r.onsetPeriod.end } : { startDate };
      }
      if (r.abatementDateTime) {
        return { startDate: r.abatementDateTime };
      }
      if (r.abatementPeriod?.start || r.abatementPeriod?.end) {
        const startDate = r.abatementPeriod.start ?? r.abatementPeriod.end ?? "";
        return r.abatementPeriod.end
          ? { startDate, endDate: r.abatementPeriod.end }
          : { startDate };
      }
      if (r.recordedDate) {
        return { startDate: r.recordedDate };
      }
      break;
    }
    case "Observation": {
      const r = resource as Observation;
      if (r.effectiveDateTime) {
        return { startDate: r.effectiveDateTime };
      }
      if (r.effectivePeriod?.start || r.effectivePeriod?.end) {
        const startDate = r.effectivePeriod.start ?? r.effectivePeriod.end ?? "";
        return r.effectivePeriod.end
          ? { startDate, endDate: r.effectivePeriod.end }
          : { startDate };
      }
      if (r.effectiveInstant) {
        return { startDate: r.effectiveInstant };
      }
      if (r.issued) {
        return { startDate: r.issued };
      }
      break;
    }
    case "Encounter": {
      const r = resource as Encounter;
      if (r.period?.start || r.period?.end) {
        const startDate = r.period.start ?? r.period.end ?? "";
        return r.period.end ? { startDate, endDate: r.period.end } : { startDate };
      }
      break;
    }
    case "Procedure": {
      const r = resource as Procedure;
      if (r.performedDateTime) {
        return { startDate: r.performedDateTime };
      }
      if (r.performedPeriod?.start || r.performedPeriod?.end) {
        const startDate = r.performedPeriod.start ?? r.performedPeriod.end ?? "";
        return r.performedPeriod.end
          ? { startDate, endDate: r.performedPeriod.end }
          : { startDate };
      }
      break;
    }
    case "Immunization": {
      const r = resource as Immunization;
      if (r.occurrenceDateTime) {
        return { startDate: r.occurrenceDateTime };
      }
      if (r.recorded) {
        return { startDate: r.recorded };
      }
      break;
    }
    case "DiagnosticReport": {
      const r = resource as DiagnosticReport;
      if (r.effectiveDateTime) {
        return { startDate: r.effectiveDateTime };
      }
      if (r.effectivePeriod?.start || r.effectivePeriod?.end) {
        const startDate = r.effectivePeriod.start ?? r.effectivePeriod.end ?? "";
        return r.effectivePeriod.end
          ? { startDate, endDate: r.effectivePeriod.end }
          : { startDate };
      }
      if (r.issued) {
        return { startDate: r.issued };
      }
      break;
    }
    case "MedicationRequest": {
      const r = resource as MedicationRequest;
      if (r.authoredOn) {
        return { startDate: r.authoredOn };
      }
      break;
    }
    case "MedicationAdministration": {
      const r = resource as MedicationAdministration;
      if (r.effectiveDateTime) {
        return { startDate: r.effectiveDateTime };
      }
      if (r.effectivePeriod?.start || r.effectivePeriod?.end) {
        const startDate = r.effectivePeriod.start ?? r.effectivePeriod.end ?? "";
        return r.effectivePeriod.end
          ? { startDate, endDate: r.effectivePeriod.end }
          : { startDate };
      }
      break;
    }
    case "MedicationStatement": {
      const r = resource as MedicationStatement;
      if (r.effectiveDateTime) {
        return { startDate: r.effectiveDateTime };
      }
      if (r.effectivePeriod?.start || r.effectivePeriod?.end) {
        const startDate = r.effectivePeriod.start ?? r.effectivePeriod.end ?? "";
        return r.effectivePeriod.end
          ? { startDate, endDate: r.effectivePeriod.end }
          : { startDate };
      }
      break;
    }
    case "MedicationDispense": {
      const r = resource as MedicationDispense;
      if (r.whenHandedOver) {
        return { startDate: r.whenHandedOver };
      }
      if (r.whenPrepared) {
        return { startDate: r.whenPrepared };
      }
      break;
    }
    case "DocumentReference": {
      const r = resource as DocumentReference;
      if (r.date) {
        return { startDate: r.date };
      }
      if (r.context?.period?.start || r.context?.period?.end) {
        const startDate = r.context.period.start ?? r.context.period.end ?? "";
        return r.context.period.end ? { startDate, endDate: r.context.period.end } : { startDate };
      }
      break;
    }
    case "Composition": {
      const r = resource as Composition;
      if (r.date) {
        return { startDate: r.date };
      }
      break;
    }
    case "Coverage": {
      const r = resource as Coverage;
      if (r.period?.start || r.period?.end) {
        const startDate = r.period.start ?? r.period.end ?? "";
        return r.period.end ? { startDate, endDate: r.period.end } : { startDate };
      }
      break;
    }
    case "Appointment": {
      const r = resource as Appointment;
      if (r.start) {
        return r.end ? { startDate: r.start, endDate: r.end } : { startDate: r.start };
      }
      if (r.created) {
        return { startDate: r.created };
      }
      break;
    }
    case "ServiceRequest": {
      const r = resource as ServiceRequest;
      if (r.occurrenceDateTime) {
        return { startDate: r.occurrenceDateTime };
      }
      if (r.occurrencePeriod?.start || r.occurrencePeriod?.end) {
        const startDate = r.occurrencePeriod.start ?? r.occurrencePeriod.end ?? "";
        return r.occurrencePeriod.end
          ? { startDate, endDate: r.occurrencePeriod.end }
          : { startDate };
      }
      if (r.authoredOn) {
        return { startDate: r.authoredOn };
      }
      break;
    }
    case "Specimen": {
      const r = resource as Specimen;
      if (r.collection?.collectedDateTime) {
        return { startDate: r.collection.collectedDateTime };
      }
      if (r.collection?.collectedPeriod?.start || r.collection?.collectedPeriod?.end) {
        const startDate =
          r.collection.collectedPeriod.start ?? r.collection.collectedPeriod.end ?? "";
        return r.collection.collectedPeriod.end
          ? { startDate, endDate: r.collection.collectedPeriod.end }
          : { startDate };
      }
      if (r.receivedTime) {
        return { startDate: r.receivedTime };
      }
      break;
    }
    case "Communication": {
      const r = resource as Communication;
      if (r.sent) {
        return { startDate: r.sent };
      }
      if (r.received) {
        return { startDate: r.received };
      }
      break;
    }
    case "CommunicationRequest": {
      const r = resource as CommunicationRequest;
      if (r.occurrenceDateTime) {
        return { startDate: r.occurrenceDateTime };
      }
      if (r.occurrencePeriod?.start || r.occurrencePeriod?.end) {
        const startDate = r.occurrencePeriod.start ?? r.occurrencePeriod.end ?? "";
        return r.occurrencePeriod.end
          ? { startDate, endDate: r.occurrencePeriod.end }
          : { startDate };
      }
      if (r.authoredOn) {
        return { startDate: r.authoredOn };
      }
      break;
    }
    case "Task": {
      const r = resource as Task;
      if (r.executionPeriod?.start || r.executionPeriod?.end) {
        const startDate = r.executionPeriod.start ?? r.executionPeriod.end ?? "";
        return r.executionPeriod.end
          ? { startDate, endDate: r.executionPeriod.end }
          : { startDate };
      }
      if (r.authoredOn) {
        return { startDate: r.authoredOn };
      }
      break;
    }
    case "Media": {
      const r = resource as Media;
      if (r.createdDateTime) {
        return { startDate: r.createdDateTime };
      }
      if (r.createdPeriod?.start || r.createdPeriod?.end) {
        const startDate = r.createdPeriod.start ?? r.createdPeriod.end ?? "";
        return r.createdPeriod.end ? { startDate, endDate: r.createdPeriod.end } : { startDate };
      }
      if (r.issued) {
        return { startDate: r.issued };
      }
      break;
    }
    case "ClinicalImpression": {
      const r = resource as ClinicalImpression;
      if (r.effectiveDateTime) {
        return { startDate: r.effectiveDateTime };
      }
      if (r.effectivePeriod?.start || r.effectivePeriod?.end) {
        const startDate = r.effectivePeriod.start ?? r.effectivePeriod.end ?? "";
        return r.effectivePeriod.end
          ? { startDate, endDate: r.effectivePeriod.end }
          : { startDate };
      }
      if (r.date) {
        return { startDate: r.date };
      }
      break;
    }
    case "DeviceRequest": {
      const r = resource as DeviceRequest;
      if (r.occurrenceDateTime) {
        return { startDate: r.occurrenceDateTime };
      }
      if (r.occurrencePeriod?.start || r.occurrencePeriod?.end) {
        const startDate = r.occurrencePeriod.start ?? r.occurrencePeriod.end ?? "";
        return r.occurrencePeriod.end
          ? { startDate, endDate: r.occurrencePeriod.end }
          : { startDate };
      }
      if (r.authoredOn) {
        return { startDate: r.authoredOn };
      }
      break;
    }
    case "DeviceUseStatement": {
      const r = resource as DeviceUseStatement;
      if (r.timingTiming?.event && r.timingTiming.event.length > 0 && r.timingTiming.event[0]) {
        return { startDate: r.timingTiming.event[0] };
      }
      if (r.timingPeriod?.start || r.timingPeriod?.end) {
        const startDate = r.timingPeriod.start ?? r.timingPeriod.end ?? "";
        return r.timingPeriod.end ? { startDate, endDate: r.timingPeriod.end } : { startDate };
      }
      if (r.timingDateTime) {
        return { startDate: r.timingDateTime };
      }
      if (r.recordedOn) {
        return { startDate: r.recordedOn };
      }
      break;
    }
    case "RiskAssessment": {
      const r = resource as RiskAssessment;
      if (r.occurrenceDateTime) {
        return { startDate: r.occurrenceDateTime };
      }
      if (r.occurrencePeriod?.start || r.occurrencePeriod?.end) {
        const startDate = r.occurrencePeriod.start ?? r.occurrencePeriod.end ?? "";
        return r.occurrencePeriod.end
          ? { startDate, endDate: r.occurrencePeriod.end }
          : { startDate };
      }
      break;
    }
    case "Provenance": {
      const r = resource as Provenance;
      if (r.occurredDateTime) {
        return { startDate: r.occurredDateTime };
      }
      if (r.occurredPeriod?.start || r.occurredPeriod?.end) {
        const startDate = r.occurredPeriod.start ?? r.occurredPeriod.end ?? "";
        return r.occurredPeriod.end ? { startDate, endDate: r.occurredPeriod.end } : { startDate };
      }
      if (r.recorded) {
        return { startDate: r.recorded };
      }
      break;
    }
    case "AdverseEvent": {
      const r = resource as AdverseEvent;
      if (r.date) {
        return { startDate: r.date };
      }
      if (r.recordedDate) {
        return { startDate: r.recordedDate };
      }
      break;
    }
    case "Consent": {
      const r = resource as Consent;
      if (r.dateTime) {
        return { startDate: r.dateTime };
      }
      break;
    }
    case "CarePlan": {
      const r = resource as CarePlan;
      if (r.period?.start || r.period?.end) {
        const startDate = r.period.start ?? r.period.end ?? "";
        return r.period.end ? { startDate, endDate: r.period.end } : { startDate };
      }
      if (r.created) {
        return { startDate: r.created };
      }
      break;
    }
    case "CareTeam": {
      const r = resource as CareTeam;
      if (r.period?.start || r.period?.end) {
        const startDate = r.period.start ?? r.period.end ?? "";
        return r.period.end ? { startDate, endDate: r.period.end } : { startDate };
      }
      break;
    }
    case "FamilyMemberHistory": {
      const r = resource as FamilyMemberHistory;
      if (r.date) {
        return { startDate: r.date };
      }
      break;
    }
    case "Goal": {
      const r = resource as Goal;
      if (r.startDate) {
        return { startDate: r.startDate };
      }
      if (r.statusDate) {
        return { startDate: r.statusDate };
      }
      break;
    }
    case "Claim": {
      const r = resource as Claim;
      if (r.billablePeriod?.start || r.billablePeriod?.end) {
        const startDate = r.billablePeriod.start ?? r.billablePeriod.end ?? "";
        return r.billablePeriod.end ? { startDate, endDate: r.billablePeriod.end } : { startDate };
      }
      if (r.created) {
        return { startDate: r.created };
      }
      break;
    }
    case "ChargeItem": {
      const r = resource as ChargeItem;
      if (r.occurrenceDateTime) {
        return { startDate: r.occurrenceDateTime };
      }
      if (r.occurrencePeriod?.start || r.occurrencePeriod?.end) {
        const startDate = r.occurrencePeriod.start ?? r.occurrencePeriod.end ?? "";
        return r.occurrencePeriod.end
          ? { startDate, endDate: r.occurrencePeriod.end }
          : { startDate };
      }
      if (r.enteredDate) {
        return { startDate: r.enteredDate };
      }
      break;
    }
    case "SupplyDelivery": {
      const r = resource as SupplyDelivery;
      if (r.occurrenceDateTime) {
        return { startDate: r.occurrenceDateTime };
      }
      if (r.occurrencePeriod?.start || r.occurrencePeriod?.end) {
        const startDate = r.occurrencePeriod.start ?? r.occurrencePeriod.end ?? "";
        return r.occurrencePeriod.end
          ? { startDate, endDate: r.occurrencePeriod.end }
          : { startDate };
      }
      break;
    }
    case "SupplyRequest": {
      const r = resource as SupplyRequest;
      if (r.occurrenceDateTime) {
        return { startDate: r.occurrenceDateTime };
      }
      if (r.occurrencePeriod?.start || r.occurrencePeriod?.end) {
        const startDate = r.occurrencePeriod.start ?? r.occurrencePeriod.end ?? "";
        return r.occurrencePeriod.end
          ? { startDate, endDate: r.occurrencePeriod.end }
          : { startDate };
      }
      if (r.authoredOn) {
        return { startDate: r.authoredOn };
      }
      break;
    }
    case "EpisodeOfCare": {
      const r = resource as EpisodeOfCare;
      if (r.period?.start || r.period?.end) {
        const startDate = r.period.start ?? r.period.end ?? "";
        return r.period.end ? { startDate, endDate: r.period.end } : { startDate };
      }
      break;
    }
    case "NutritionOrder": {
      const r = resource as NutritionOrder;
      if (r.dateTime) {
        return { startDate: r.dateTime };
      }
      break;
    }
    case "VisionPrescription": {
      const r = resource as VisionPrescription;
      if (r.created) {
        return { startDate: r.created };
      }
      if (r.dateWritten) {
        return { startDate: r.dateWritten };
      }
      break;
    }
    case "RequestGroup": {
      const r = resource as RequestGroup;
      if (r.authoredOn) {
        return { startDate: r.authoredOn };
      }
      break;
    }
    case "ExplanationOfBenefit": {
      const r = resource as ExplanationOfBenefit;
      if (r.billablePeriod?.start || r.billablePeriod?.end) {
        const startDate = r.billablePeriod.start ?? r.billablePeriod.end ?? "";
        return r.billablePeriod.end ? { startDate, endDate: r.billablePeriod.end } : { startDate };
      }
      if (r.created) {
        return { startDate: r.created };
      }
      break;
    }
    case "Flag": {
      const r = resource as Flag;
      if (r.period?.start || r.period?.end) {
        const startDate = r.period.start ?? r.period.end ?? "";
        return r.period.end ? { startDate, endDate: r.period.end } : { startDate };
      }
      break;
    }
    case "BiologicallyDerivedProduct": {
      const r = resource as BiologicallyDerivedProduct;
      if (r.collection?.collectedDateTime) {
        return { startDate: r.collection.collectedDateTime };
      }
      if (r.collection?.collectedPeriod?.start || r.collection?.collectedPeriod?.end) {
        const startDate =
          r.collection.collectedPeriod.start ?? r.collection.collectedPeriod.end ?? "";
        return r.collection.collectedPeriod.end
          ? { startDate, endDate: r.collection.collectedPeriod.end }
          : { startDate };
      }
      break;
    }
    case "QuestionnaireResponse": {
      const r = resource as QuestionnaireResponse;
      if (r.authored) {
        return { startDate: r.authored };
      }
      break;
    }
    case "List": {
      const r = resource as List;
      if (r.date) {
        return { startDate: r.date };
      }
      break;
    }
    case "Invoice": {
      const r = resource as Invoice;
      if (r.date) {
        return { startDate: r.date };
      }
      break;
    }
    case "ImagingStudy": {
      const r = resource as ImagingStudy;
      if (r.started) {
        return { startDate: r.started };
      }
      break;
    }
  }

  return undefined;
}

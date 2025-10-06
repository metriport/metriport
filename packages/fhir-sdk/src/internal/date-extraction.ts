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
import { DateIndexRecord } from "../types/sdk-types";

/**
 * Parse date string to milliseconds timestamp, with validation
 */
export function parseDate(dateString: string | undefined): number | undefined {
  if (!dateString) {
    return undefined;
  }

  const date = new Date(dateString);
  const timestamp = date.getTime();

  // Validate date is reasonable (between 1900 and 2100)
  if (
    isNaN(timestamp) ||
    timestamp < new Date("1900-01-01").getTime() ||
    timestamp > new Date("2100-01-01").getTime()
  ) {
    return undefined;
  }

  return timestamp;
}

/**
 * Extract date intervals from a resource based on its type
 * Returns array of date intervals with metadata
 */
export function extractDateIntervalsFromResource(resource: Resource): DateIndexRecord[] {
  const intervals: DateIndexRecord[] = [];
  const resourceId = resource.id;

  if (resourceId === undefined) {
    return intervals;
  }

  /**
   * Helper to add a date interval to the intervals array. Use arrow to prevent hoist.
   */
  // eslint-disable-next-line @metriport/eslint-rules/no-named-arrow-functions
  const addDateInterval = (
    dateField: string,
    low: string | undefined,
    high?: string | undefined
  ) => {
    const lowMs = parseDate(low);
    const highMs = parseDate(high ?? low);

    if (lowMs !== undefined && highMs !== undefined) {
      intervals.push({
        low: lowMs,
        high: highMs,
        resourceId: resourceId,
        resourceType: resource.resourceType,
        dateField,
      });
    }
  };

  switch (resource.resourceType) {
    case "AllergyIntolerance": {
      const r = resource as AllergyIntolerance;
      if (r.onsetDateTime) {
        addDateInterval("onsetDateTime", r.onsetDateTime);
      }
      if (r.onsetPeriod?.start || r.onsetPeriod?.end) {
        addDateInterval("onsetPeriod", r.onsetPeriod.start, r.onsetPeriod.end);
      }
      if (r.lastOccurrence) {
        addDateInterval("lastOccurrence", r.lastOccurrence);
      }
      if (r.recordedDate) {
        addDateInterval("recordedDate", r.recordedDate);
      }
      break;
    }
    case "Condition": {
      const r = resource as Condition;
      if (r.onsetDateTime) {
        addDateInterval("onsetDateTime", r.onsetDateTime);
      }
      if (r.onsetPeriod?.start || r.onsetPeriod?.end) {
        addDateInterval("onsetPeriod", r.onsetPeriod.start, r.onsetPeriod.end);
      }
      if (r.abatementDateTime) {
        addDateInterval("abatementDateTime", r.abatementDateTime);
      }
      if (r.abatementPeriod?.start || r.abatementPeriod?.end) {
        addDateInterval("abatementPeriod", r.abatementPeriod.start, r.abatementPeriod.end);
      }
      if (r.recordedDate) {
        addDateInterval("recordedDate", r.recordedDate);
      }
      break;
    }
    case "Observation": {
      const r = resource as Observation;
      if (r.effectiveDateTime) {
        addDateInterval("effectiveDateTime", r.effectiveDateTime);
      }
      if (r.effectivePeriod?.start || r.effectivePeriod?.end) {
        addDateInterval("effectivePeriod", r.effectivePeriod.start, r.effectivePeriod.end);
      }
      if (r.effectiveInstant) {
        addDateInterval("effectiveInstant", r.effectiveInstant);
      }
      if (r.issued) {
        addDateInterval("issued", r.issued);
      }
      break;
    }
    case "Encounter": {
      const r = resource as Encounter;
      if (r.period?.start || r.period?.end) {
        addDateInterval("period", r.period.start, r.period.end);
      }
      break;
    }
    case "Procedure": {
      const r = resource as Procedure;
      if (r.performedDateTime) {
        addDateInterval("performedDateTime", r.performedDateTime);
      }
      if (r.performedPeriod?.start || r.performedPeriod?.end) {
        addDateInterval("performedPeriod", r.performedPeriod.start, r.performedPeriod.end);
      }
      break;
    }
    case "Immunization": {
      const r = resource as Immunization;
      if (r.occurrenceDateTime) {
        addDateInterval("occurrenceDateTime", r.occurrenceDateTime);
      }
      if (r.recorded) {
        addDateInterval("recorded", r.recorded);
      }
      break;
    }
    case "DiagnosticReport": {
      const r = resource as DiagnosticReport;
      if (r.effectiveDateTime) {
        addDateInterval("effectiveDateTime", r.effectiveDateTime);
      }
      if (r.effectivePeriod?.start || r.effectivePeriod?.end) {
        addDateInterval("effectivePeriod", r.effectivePeriod.start, r.effectivePeriod.end);
      }
      if (r.issued) {
        addDateInterval("issued", r.issued);
      }
      break;
    }
    case "MedicationRequest": {
      const r = resource as MedicationRequest;
      if (r.authoredOn) {
        addDateInterval("authoredOn", r.authoredOn);
      }
      break;
    }
    case "MedicationAdministration": {
      const r = resource as MedicationAdministration;
      if (r.effectiveDateTime) {
        addDateInterval("effectiveDateTime", r.effectiveDateTime);
      }
      if (r.effectivePeriod?.start || r.effectivePeriod?.end) {
        addDateInterval("effectivePeriod", r.effectivePeriod.start, r.effectivePeriod.end);
      }
      break;
    }
    case "MedicationStatement": {
      const r = resource as MedicationStatement;
      if (r.effectiveDateTime) {
        addDateInterval("effectiveDateTime", r.effectiveDateTime);
      }
      if (r.effectivePeriod?.start || r.effectivePeriod?.end) {
        addDateInterval("effectivePeriod", r.effectivePeriod.start, r.effectivePeriod.end);
      }
      break;
    }
    case "MedicationDispense": {
      const r = resource as MedicationDispense;
      if (r.whenHandedOver) {
        addDateInterval("whenHandedOver", r.whenHandedOver);
      }
      if (r.whenPrepared) {
        addDateInterval("whenPrepared", r.whenPrepared);
      }
      break;
    }
    case "DocumentReference": {
      const r = resource as DocumentReference;
      if (r.date) {
        addDateInterval("date", r.date);
      }
      if (r.context?.period?.start || r.context?.period?.end) {
        addDateInterval("context.period", r.context.period.start, r.context.period.end);
      }
      break;
    }
    case "Composition": {
      const r = resource as Composition;
      if (r.date) {
        addDateInterval("date", r.date);
      }
      break;
    }
    case "Coverage": {
      const r = resource as Coverage;
      if (r.period?.start || r.period?.end) {
        addDateInterval("period", r.period.start, r.period.end);
      }
      break;
    }
    case "Appointment": {
      const r = resource as Appointment;
      if (r.start) {
        addDateInterval("start", r.start, r.end);
      }
      if (r.created) {
        addDateInterval("created", r.created);
      }
      if (r.requestedPeriod) {
        r.requestedPeriod.forEach((period, index) => {
          if (period.start || period.end) {
            addDateInterval(`requestedPeriod[${index}]`, period.start, period.end);
          }
        });
      }
      break;
    }
    case "ServiceRequest": {
      const r = resource as ServiceRequest;
      if (r.occurrenceDateTime) {
        addDateInterval("occurrenceDateTime", r.occurrenceDateTime);
      }
      if (r.occurrencePeriod?.start || r.occurrencePeriod?.end) {
        addDateInterval("occurrencePeriod", r.occurrencePeriod.start, r.occurrencePeriod.end);
      }
      if (r.authoredOn) {
        addDateInterval("authoredOn", r.authoredOn);
      }
      break;
    }
    case "Specimen": {
      const r = resource as Specimen;
      if (r.collection?.collectedDateTime) {
        addDateInterval("collection.collectedDateTime", r.collection.collectedDateTime);
      }
      if (r.collection?.collectedPeriod?.start || r.collection?.collectedPeriod?.end) {
        addDateInterval(
          "collection.collectedPeriod",
          r.collection.collectedPeriod.start,
          r.collection.collectedPeriod.end
        );
      }
      if (r.receivedTime) {
        addDateInterval("receivedTime", r.receivedTime);
      }
      if (r.processing) {
        r.processing.forEach((proc, index) => {
          if (proc.timeDateTime) {
            addDateInterval(`processing[${index}].timeDateTime`, proc.timeDateTime);
          }
          if (proc.timePeriod?.start || proc.timePeriod?.end) {
            addDateInterval(
              `processing[${index}].timePeriod`,
              proc.timePeriod.start,
              proc.timePeriod.end
            );
          }
        });
      }
      break;
    }
    case "Communication": {
      const r = resource as Communication;
      if (r.sent) {
        addDateInterval("sent", r.sent);
      }
      if (r.received) {
        addDateInterval("received", r.received);
      }
      break;
    }
    case "CommunicationRequest": {
      const r = resource as CommunicationRequest;
      if (r.occurrenceDateTime) {
        addDateInterval("occurrenceDateTime", r.occurrenceDateTime);
      }
      if (r.occurrencePeriod?.start || r.occurrencePeriod?.end) {
        addDateInterval("occurrencePeriod", r.occurrencePeriod.start, r.occurrencePeriod.end);
      }
      if (r.authoredOn) {
        addDateInterval("authoredOn", r.authoredOn);
      }
      break;
    }
    case "Task": {
      const r = resource as Task;
      if (r.executionPeriod?.start || r.executionPeriod?.end) {
        addDateInterval("executionPeriod", r.executionPeriod.start, r.executionPeriod.end);
      }
      if (r.authoredOn) {
        addDateInterval("authoredOn", r.authoredOn);
      }
      if (r.lastModified) {
        addDateInterval("lastModified", r.lastModified);
      }
      break;
    }
    case "Media": {
      const r = resource as Media;
      if (r.createdDateTime) {
        addDateInterval("createdDateTime", r.createdDateTime);
      }
      if (r.createdPeriod?.start || r.createdPeriod?.end) {
        addDateInterval("createdPeriod", r.createdPeriod.start, r.createdPeriod.end);
      }
      if (r.issued) {
        addDateInterval("issued", r.issued);
      }
      break;
    }
    case "ClinicalImpression": {
      const r = resource as ClinicalImpression;
      if (r.effectiveDateTime) {
        addDateInterval("effectiveDateTime", r.effectiveDateTime);
      }
      if (r.effectivePeriod?.start || r.effectivePeriod?.end) {
        addDateInterval("effectivePeriod", r.effectivePeriod.start, r.effectivePeriod.end);
      }
      if (r.date) {
        addDateInterval("date", r.date);
      }
      break;
    }
    case "DeviceRequest": {
      const r = resource as DeviceRequest;
      if (r.occurrenceDateTime) {
        addDateInterval("occurrenceDateTime", r.occurrenceDateTime);
      }
      if (r.occurrencePeriod?.start || r.occurrencePeriod?.end) {
        addDateInterval("occurrencePeriod", r.occurrencePeriod.start, r.occurrencePeriod.end);
      }
      if (r.authoredOn) {
        addDateInterval("authoredOn", r.authoredOn);
      }
      break;
    }
    case "DeviceUseStatement": {
      const r = resource as DeviceUseStatement;
      if (r.timingTiming?.event) {
        r.timingTiming.event.forEach((eventDate, index) => {
          if (eventDate) {
            addDateInterval(`timingTiming.event[${index}]`, eventDate);
          }
        });
      }
      if (r.timingPeriod?.start || r.timingPeriod?.end) {
        addDateInterval("timingPeriod", r.timingPeriod.start, r.timingPeriod.end);
      }
      if (r.timingDateTime) {
        addDateInterval("timingDateTime", r.timingDateTime);
      }
      if (r.recordedOn) {
        addDateInterval("recordedOn", r.recordedOn);
      }
      break;
    }
    case "RiskAssessment": {
      const r = resource as RiskAssessment;
      if (r.occurrenceDateTime) {
        addDateInterval("occurrenceDateTime", r.occurrenceDateTime);
      }
      if (r.occurrencePeriod?.start || r.occurrencePeriod?.end) {
        addDateInterval("occurrencePeriod", r.occurrencePeriod.start, r.occurrencePeriod.end);
      }
      break;
    }
    case "Provenance": {
      const r = resource as Provenance;
      if (r.occurredDateTime) {
        addDateInterval("occurredDateTime", r.occurredDateTime);
      }
      if (r.occurredPeriod?.start || r.occurredPeriod?.end) {
        addDateInterval("occurredPeriod", r.occurredPeriod.start, r.occurredPeriod.end);
      }
      if (r.recorded) {
        addDateInterval("recorded", r.recorded);
      }
      break;
    }
    case "AdverseEvent": {
      const r = resource as AdverseEvent;
      if (r.date) {
        addDateInterval("date", r.date);
      }
      if (r.recordedDate) {
        addDateInterval("recordedDate", r.recordedDate);
      }
      break;
    }
    case "Consent": {
      const r = resource as Consent;
      if (r.dateTime) {
        addDateInterval("dateTime", r.dateTime);
      }
      if (r.provision?.period?.start || r.provision?.period?.end) {
        addDateInterval("provision.period", r.provision.period.start, r.provision.period.end);
      }
      if (r.provision?.dataPeriod?.start || r.provision?.dataPeriod?.end) {
        addDateInterval(
          "provision.dataPeriod",
          r.provision.dataPeriod.start,
          r.provision.dataPeriod.end
        );
      }
      break;
    }
    case "CarePlan": {
      const r = resource as CarePlan;
      if (r.period?.start || r.period?.end) {
        addDateInterval("period", r.period.start, r.period.end);
      }
      if (r.created) {
        addDateInterval("created", r.created);
      }
      break;
    }
    case "CareTeam": {
      const r = resource as CareTeam;
      if (r.period?.start || r.period?.end) {
        addDateInterval("period", r.period.start, r.period.end);
      }
      if (r.participant) {
        r.participant.forEach((p, index) => {
          if (p.period?.start || p.period?.end) {
            addDateInterval(`participant[${index}].period`, p.period.start, p.period.end);
          }
        });
      }
      break;
    }
    case "FamilyMemberHistory": {
      const r = resource as FamilyMemberHistory;
      if (r.date) {
        addDateInterval("date", r.date);
      }
      if (r.bornPeriod?.start || r.bornPeriod?.end) {
        addDateInterval("bornPeriod", r.bornPeriod.start, r.bornPeriod.end);
      }
      if (r.bornDate) {
        addDateInterval("bornDate", r.bornDate);
      }
      if (r.deceasedDate) {
        addDateInterval("deceasedDate", r.deceasedDate);
      }
      break;
    }
    case "Goal": {
      const r = resource as Goal;
      if (r.startDate) {
        addDateInterval("startDate", r.startDate);
      }
      if (r.statusDate) {
        addDateInterval("statusDate", r.statusDate);
      }
      if (r.target) {
        r.target.forEach((t, index) => {
          if (t.dueDate) {
            addDateInterval(`target[${index}].dueDate`, t.dueDate);
          }
        });
      }
      break;
    }
    case "Claim": {
      const r = resource as Claim;
      if (r.billablePeriod?.start || r.billablePeriod?.end) {
        addDateInterval("billablePeriod", r.billablePeriod.start, r.billablePeriod.end);
      }
      if (r.created) {
        addDateInterval("created", r.created);
      }
      if (r.accident?.date) {
        addDateInterval("accident.date", r.accident.date);
      }
      if (r.item) {
        r.item.forEach((item, index) => {
          if (item.servicedDate) {
            addDateInterval(`item[${index}].servicedDate`, item.servicedDate);
          }
          if (item.servicedPeriod?.start || item.servicedPeriod?.end) {
            addDateInterval(
              `item[${index}].servicedPeriod`,
              item.servicedPeriod.start,
              item.servicedPeriod.end
            );
          }
        });
      }
      break;
    }
    case "ChargeItem": {
      const r = resource as ChargeItem;
      if (r.occurrenceDateTime) {
        addDateInterval("occurrenceDateTime", r.occurrenceDateTime);
      }
      if (r.occurrencePeriod?.start || r.occurrencePeriod?.end) {
        addDateInterval("occurrencePeriod", r.occurrencePeriod.start, r.occurrencePeriod.end);
      }
      if (r.enteredDate) {
        addDateInterval("enteredDate", r.enteredDate);
      }
      break;
    }
    case "SupplyDelivery": {
      const r = resource as SupplyDelivery;
      if (r.occurrenceDateTime) {
        addDateInterval("occurrenceDateTime", r.occurrenceDateTime);
      }
      if (r.occurrencePeriod?.start || r.occurrencePeriod?.end) {
        addDateInterval("occurrencePeriod", r.occurrencePeriod.start, r.occurrencePeriod.end);
      }
      break;
    }
    case "SupplyRequest": {
      const r = resource as SupplyRequest;
      if (r.occurrenceDateTime) {
        addDateInterval("occurrenceDateTime", r.occurrenceDateTime);
      }
      if (r.occurrencePeriod?.start || r.occurrencePeriod?.end) {
        addDateInterval("occurrencePeriod", r.occurrencePeriod.start, r.occurrencePeriod.end);
      }
      if (r.authoredOn) {
        addDateInterval("authoredOn", r.authoredOn);
      }
      break;
    }
    case "EpisodeOfCare": {
      const r = resource as EpisodeOfCare;
      if (r.period?.start || r.period?.end) {
        addDateInterval("period", r.period.start, r.period.end);
      }
      if (r.statusHistory) {
        r.statusHistory.forEach((sh, index) => {
          if (sh.period?.start || sh.period?.end) {
            addDateInterval(`statusHistory[${index}].period`, sh.period.start, sh.period.end);
          }
        });
      }
      break;
    }
    case "NutritionOrder": {
      const r = resource as NutritionOrder;
      if (r.dateTime) {
        addDateInterval("dateTime", r.dateTime);
      }
      break;
    }
    case "VisionPrescription": {
      const r = resource as VisionPrescription;
      if (r.created) {
        addDateInterval("created", r.created);
      }
      if (r.dateWritten) {
        addDateInterval("dateWritten", r.dateWritten);
      }
      break;
    }
    case "RequestGroup": {
      const r = resource as RequestGroup;
      if (r.authoredOn) {
        addDateInterval("authoredOn", r.authoredOn);
      }
      break;
    }
    case "ExplanationOfBenefit": {
      const r = resource as ExplanationOfBenefit;
      if (r.billablePeriod?.start || r.billablePeriod?.end) {
        addDateInterval("billablePeriod", r.billablePeriod.start, r.billablePeriod.end);
      }
      if (r.created) {
        addDateInterval("created", r.created);
      }
      if (r.item) {
        r.item.forEach((item, index) => {
          if (item.servicedDate) {
            addDateInterval(`item[${index}].servicedDate`, item.servicedDate);
          }
          if (item.servicedPeriod?.start || item.servicedPeriod?.end) {
            addDateInterval(
              `item[${index}].servicedPeriod`,
              item.servicedPeriod.start,
              item.servicedPeriod.end
            );
          }
        });
      }
      break;
    }
    case "Flag": {
      const r = resource as Flag;
      if (r.period?.start || r.period?.end) {
        addDateInterval("period", r.period.start, r.period.end);
      }
      break;
    }
    case "BiologicallyDerivedProduct": {
      const r = resource as BiologicallyDerivedProduct;
      if (r.collection?.collectedDateTime) {
        addDateInterval("collection.collectedDateTime", r.collection.collectedDateTime);
      }
      if (r.collection?.collectedPeriod?.start || r.collection?.collectedPeriod?.end) {
        addDateInterval(
          "collection.collectedPeriod",
          r.collection.collectedPeriod.start,
          r.collection.collectedPeriod.end
        );
      }
      if (r.processing) {
        r.processing.forEach((proc, index) => {
          if (proc.timeDateTime) {
            addDateInterval(`processing[${index}].timeDateTime`, proc.timeDateTime);
          }
          if (proc.timePeriod?.start || proc.timePeriod?.end) {
            addDateInterval(
              `processing[${index}].timePeriod`,
              proc.timePeriod.start,
              proc.timePeriod.end
            );
          }
        });
      }
      break;
    }
    case "QuestionnaireResponse": {
      const r = resource as QuestionnaireResponse;
      if (r.authored) {
        addDateInterval("authored", r.authored);
      }
      break;
    }
    case "List": {
      const r = resource as List;
      if (r.date) {
        addDateInterval("date", r.date);
      }
      break;
    }
    case "Invoice": {
      const r = resource as Invoice;
      if (r.date) {
        addDateInterval("date", r.date);
      }
      break;
    }
    case "ImagingStudy": {
      const r = resource as ImagingStudy;
      if (r.started) {
        addDateInterval("started", r.started);
      }
      break;
    }
  }

  return intervals;
}

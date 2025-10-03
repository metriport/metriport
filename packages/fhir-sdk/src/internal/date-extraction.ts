import {
  Resource,
  AllergyIntolerance,
  Condition,
  Observation,
  Encounter,
  Procedure,
  Immunization,
  DiagnosticReport,
  MedicationRequest,
  MedicationAdministration,
  MedicationStatement,
  MedicationDispense,
  DocumentReference,
  Composition,
  Coverage,
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
  }

  return intervals;
}

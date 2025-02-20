import {
  AllergyIntolerance,
  Bundle,
  Communication,
  Composition,
  Condition,
  Consent,
  Coverage,
  DiagnosticReport,
  DocumentReference,
  Encounter,
  Goal,
  Immunization,
  MedicationAdministration,
  MedicationDispense,
  MedicationRequest,
  MedicationStatement,
  Observation,
  Patient,
  Procedure,
  Provenance,
  RelatedPerson,
} from "@medplum/fhirtypes";
import { addAgeToDob } from "../../external/fhir/shared/age";
import {
  areDatesWithinRange,
  arePeriodsWithinRange,
  areRangesWithinRange,
  DateRange,
  dateRangeToOngoing,
  getDatesFromEffectiveDateTimeOrPeriod,
  isDateWithinDateRange,
  isPeriodWithinRange,
} from "./consolidated-filter-shared";

const includeIfNoDate = true;

/**
 * Filters resources in a FHIR Bundle by date.
 *
 * @param bundle The FHIR Bundle to filter.
 * @param dateFrom The start date for filtering (inclusive).
 * @param dateTo The end date for filtering (inclusive).
 * @returns A new FHIR Bundle based on the original one, containing only the filtered resources.
 */
export function filterBundleByDate(bundle: Bundle, dateFrom?: string, dateTo?: string): Bundle {
  if (!dateFrom && !dateTo) return bundle;
  const range = { dateFrom, dateTo };

  const patient = bundle.entry?.find(entry => entry.resource?.resourceType === "Patient")
    ?.resource as Patient | undefined;

  const filteredEntries = bundle.entry?.filter(entry => {
    if (!entry.resource) return false;
    switch (entry.resource.resourceType) {
      case "AllergyIntolerance":
        return isAllergyIntoleranceWithinDateRange(entry.resource, range, patient);
      case "Communication":
        return isCommunicationWithinDateRange(entry.resource, range);
      case "Composition":
        return isCompositionWithinDateRange(entry.resource, range);
      case "Condition":
        return isConditionWithinDateRange(entry.resource, range, patient);
      case "Consent":
        return isConsentWithinDateRange(entry.resource, range);
      case "Coverage":
        return isCoverageWithinDateRange(entry.resource, range);
      case "DiagnosticReport":
        return isDiagnosticReportWithinDateRange(entry.resource, range);
      case "DocumentReference":
        return isDocumentReferenceWithinDateRange(entry.resource, range);
      case "Encounter":
        return isEncounterWithinDateRange(entry.resource, range);
      case "Goal":
        return isGoalWithinDateRange(entry.resource, range);
      case "Immunization":
        return isImmunizationWithinDateRange(entry.resource, range);
      case "MedicationAdministration":
        return isMedicationAdministrationWithinDateRange(entry.resource, range);
      case "MedicationDispense":
        return isMedicationDispenseWithinDateRange(entry.resource, range);
      case "MedicationRequest":
        return isMedicationRequestWithinDateRange(entry.resource, range);
      case "MedicationStatement":
        return isMedicationStatementWithinDateRange(entry.resource, range);
      case "Observation":
        return isObservationWithinDateRange(entry.resource, range);
      case "Procedure":
        return isProcedureWithinDateRange(entry.resource, range, patient);
      case "Provenance":
        return isProvenanceWithinDateRange(entry.resource, range);
      case "RelatedPerson":
        return isRelatedPersonWithinDateRange(entry.resource, range);
    }
    return includeIfNoDate;
  });
  return {
    ...bundle,
    total: filteredEntries?.length ?? 0,
    entry: filteredEntries ?? [],
  };
}

function isAllergyIntoleranceWithinDateRange(
  resource: AllergyIntolerance,
  range: DateRange,
  patient: Patient | undefined
): boolean {
  if (resource.onsetPeriod) {
    const res = arePeriodsWithinRange([resource.onsetPeriod], range);
    if (res !== undefined) return res;
  }
  if (resource.onsetRange) {
    const res = areRangesWithinRange([resource.onsetRange], range);
    if (res !== undefined) return res;
  }
  if (resource.lastOccurrence) {
    const res = isDateWithinDateRange(resource.lastOccurrence, range);
    if (res !== undefined) return res;
  }
  if (resource.onsetString) {
    const res = isDateWithinDateRange(resource.onsetString, dateRangeToOngoing(range));
    if (res !== undefined) return res;
  }
  if (resource.onsetDateTime) {
    const res = isDateWithinDateRange(resource.onsetDateTime, dateRangeToOngoing(range));
    if (res !== undefined) return res;
  }
  if (resource.onsetAge && patient?.birthDate) {
    const date = addAgeToDob(resource.onsetAge, patient.birthDate);
    const res = isDateWithinDateRange(date, dateRangeToOngoing(range));
    if (res !== undefined) return res;
  }
  if (resource.reaction && resource.reaction.length > 0) {
    const dates = resource.reaction.flatMap(r => r.onset ?? []);
    const res = areDatesWithinRange(dates, dateRangeToOngoing(range));
    if (res !== undefined) return res;
  }
  return includeIfNoDate;
}

function isCommunicationWithinDateRange(resource: Communication, range: DateRange): boolean {
  const res = areDatesWithinRange([resource.sent, resource.received], range);
  if (res !== undefined) return res;
  return includeIfNoDate;
}

function isCompositionWithinDateRange(resource: Composition, range: DateRange): boolean {
  const periods = resource.event?.map(e => e.period);
  const res = arePeriodsWithinRange(periods, range);
  if (res !== undefined) return res;
  return includeIfNoDate;
}

function isConditionWithinDateRange(
  resource: Condition,
  range: DateRange,
  patient: Patient | undefined
): boolean {
  if (resource.onsetPeriod) {
    const res = arePeriodsWithinRange([resource.onsetPeriod], range);
    if (res !== undefined) return res;
  }
  if (resource.onsetRange) {
    const res = areRangesWithinRange([resource.onsetRange], range);
    if (res !== undefined) return res;
  }
  if (resource.onsetString) {
    const res = isDateWithinDateRange(resource.onsetString, dateRangeToOngoing(range));
    if (res !== undefined) return res;
  }
  if (resource.onsetDateTime) {
    const res = isDateWithinDateRange(resource.onsetDateTime, dateRangeToOngoing(range));
    if (res !== undefined) return res;
  }
  if (resource.onsetAge && patient?.birthDate) {
    const date = addAgeToDob(resource.onsetAge, patient.birthDate);
    const res = isDateWithinDateRange(date, dateRangeToOngoing(range));
    if (res !== undefined) return res;
  }
  if (resource.abatementPeriod) {
    const res = arePeriodsWithinRange([resource.abatementPeriod], range);
    if (res !== undefined) return res;
  }
  if (resource.abatementRange) {
    const res = areRangesWithinRange([resource.abatementRange], range);
    if (res !== undefined) return res;
  }
  if (resource.abatementString) {
    const res = isDateWithinDateRange(resource.abatementString, range);
    if (res !== undefined) return res;
  }
  if (resource.abatementDateTime) {
    const res = isDateWithinDateRange(resource.abatementDateTime, range);
    if (res !== undefined) return res;
  }
  if (resource.abatementAge && patient?.birthDate) {
    const date = addAgeToDob(resource.abatementAge, patient.birthDate);
    const res = isDateWithinDateRange(date, range);
    if (res !== undefined) return res;
  }
  return includeIfNoDate;
}

function isEncounterWithinDateRange(resource: Encounter, range: DateRange): boolean {
  if (resource.period) {
    const res = arePeriodsWithinRange([resource.period], range);
    if (res !== undefined) return res;
  }
  if (resource.location) {
    const periods = resource.location.map(l => l.period);
    const res = arePeriodsWithinRange(periods, range);
    if (res !== undefined) return res;
  }
  return includeIfNoDate;
}

function isDiagnosticReportWithinDateRange(resource: DiagnosticReport, range: DateRange): boolean {
  const dates = getDatesFromEffectiveDateTimeOrPeriod(resource);
  const res = areDatesWithinRange(dates, range);
  if (res !== undefined) return res;
  return includeIfNoDate;
}

function isDocumentReferenceWithinDateRange(
  resource: DocumentReference,
  range: DateRange
): boolean {
  const res = isPeriodWithinRange(resource.context?.period, range);
  if (res !== undefined) return res;
  return includeIfNoDate;
}

function isConsentWithinDateRange(resource: Consent, range: DateRange): boolean {
  const res = isDateWithinDateRange(resource.dateTime, range);
  if (res !== undefined) return res;
  return includeIfNoDate;
}

function isCoverageWithinDateRange(resource: Coverage, range: DateRange): boolean {
  const res = isPeriodWithinRange(resource.period, range);
  if (res !== undefined) return res;
  return includeIfNoDate;
}

function isGoalWithinDateRange(resource: Goal, range: DateRange): boolean {
  if (resource.startDate) {
    const res = isDateWithinDateRange(resource.startDate, range);
    if (res !== undefined) return res;
  }
  if (resource.target && resource.target.length > 0) {
    const dates = resource.target.flatMap(t => t?.dueDate ?? []);
    const res = areDatesWithinRange(dates, range);
    if (res !== undefined) return res;
  }
  return includeIfNoDate;
}

function isImmunizationWithinDateRange(resource: Immunization, range: DateRange): boolean {
  if (resource.occurrenceDateTime) {
    const res = isDateWithinDateRange(resource.occurrenceDateTime, range);
    if (res !== undefined) return res;
  }
  if (resource.occurrenceString) {
    const res = isDateWithinDateRange(resource.occurrenceString, range);
    if (res !== undefined) return res;
  }
  if (resource.reaction && resource.reaction.length > 0) {
    const dates = resource.reaction.flatMap(r => r.date ?? []);
    const res = areDatesWithinRange(dates, range);
    if (res !== undefined) return res;
  }
  return includeIfNoDate;
}

function isMedicationDispenseWithinDateRange(
  resource: MedicationDispense,
  range: DateRange
): boolean {
  if (resource.whenHandedOver) {
    const res = isDateWithinDateRange(resource.whenHandedOver, range);
    if (res !== undefined) return res;
  }
  if (resource.whenPrepared) {
    const res = isDateWithinDateRange(resource.whenPrepared, range);
    if (res !== undefined) return res;
  }
  return includeIfNoDate;
}

function isMedicationRequestWithinDateRange(
  resource: MedicationRequest,
  range: DateRange
): boolean {
  const res = isDateWithinDateRange(resource.authoredOn, range);
  if (res !== undefined) return res;
  return includeIfNoDate;
}

function isMedicationAdministrationWithinDateRange(
  resource: MedicationAdministration,
  range: DateRange
): boolean {
  if (resource.effectivePeriod) {
    const res = isPeriodWithinRange(resource.effectivePeriod, range);
    if (res !== undefined) return res;
  }
  if (resource.effectiveDateTime) {
    const res = isDateWithinDateRange(resource.effectiveDateTime, range);
    if (res !== undefined) return res;
  }
  return includeIfNoDate;
}

function isMedicationStatementWithinDateRange(
  resource: MedicationStatement,
  range: DateRange
): boolean {
  if (resource.effectivePeriod) {
    const res = isPeriodWithinRange(resource.effectivePeriod, range);
    if (res !== undefined) return res;
  }
  if (resource.effectiveDateTime) {
    const res = isDateWithinDateRange(resource.effectiveDateTime, range);
    if (res !== undefined) return res;
  }
  return includeIfNoDate;
}

function isObservationWithinDateRange(resource: Observation, range: DateRange): boolean {
  if (resource.effectivePeriod) {
    const res = isPeriodWithinRange(resource.effectivePeriod, range);
    if (res !== undefined) return res;
  }
  if (resource.effectiveDateTime) {
    const res = isDateWithinDateRange(resource.effectiveDateTime, range);
    if (res !== undefined) return res;
  }
  if (resource.effectiveInstant) {
    const res = isDateWithinDateRange(resource.effectiveInstant, range);
    if (res !== undefined) return res;
  }
  if (resource.issued) {
    const res = isDateWithinDateRange(resource.issued, range);
    if (res !== undefined) return res;
  }
  return includeIfNoDate;
}

function isProcedureWithinDateRange(
  resource: Procedure,
  range: DateRange,
  patient: Patient | undefined
): boolean {
  if (resource.performedPeriod) {
    const res = isPeriodWithinRange(resource.performedPeriod, range);
    if (res !== undefined) return res;
  }
  if (resource.performedRange) {
    const res = areRangesWithinRange([resource.performedRange], range);
    if (res !== undefined) return res;
  }
  if (resource.performedDateTime) {
    const res = isDateWithinDateRange(resource.performedDateTime, range);
    if (res !== undefined) return res;
  }
  if (resource.performedString) {
    const res = isDateWithinDateRange(resource.performedString, range);
    if (res !== undefined) return res;
  }
  if (resource.performedAge && patient?.birthDate) {
    const date = addAgeToDob(resource.performedAge, patient.birthDate);
    const res = isDateWithinDateRange(date, range);
    if (res !== undefined) return res;
  }
  return includeIfNoDate;
}

function isProvenanceWithinDateRange(resource: Provenance, range: DateRange): boolean {
  if (resource.occurredPeriod) {
    const res = isPeriodWithinRange(resource.occurredPeriod, range);
    if (res !== undefined) return res;
  }
  if (resource.occurredDateTime) {
    const res = isDateWithinDateRange(resource.occurredDateTime, range);
    if (res !== undefined) return res;
  }
  if (resource.recorded) {
    const res = isDateWithinDateRange(resource.recorded, range);
    if (res !== undefined) return res;
  }
  return includeIfNoDate;
}

function isRelatedPersonWithinDateRange(resource: RelatedPerson, range: DateRange): boolean {
  const res = isPeriodWithinRange(resource.period, range);
  if (res !== undefined) return res;
  return includeIfNoDate;
}

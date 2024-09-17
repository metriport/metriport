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
  FamilyMemberHistory,
  Goal,
  Immunization,
  MedicationAdministration,
  MedicationDispense,
  MedicationRequest,
  MedicationStatement,
  Observation,
  Procedure,
  Provenance,
  RelatedPerson,
} from "@medplum/fhirtypes";
import {
  areDatesWithinRange,
  arePeriodsWithinRange,
  areRangesWithinRange,
  DateRange,
  getDatesFromEffectiveDateTimeOrPeriod,
  isDateWithinDateRange,
  isPeriodWithinRange,
  safeDate,
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

  const filteredEntries = bundle.entry?.filter(entry => {
    if (!entry.resource) return false;
    switch (entry.resource.resourceType) {
      case "AllergyIntolerance":
        return isAllergyIntoleranceWithinDateRange(entry.resource, range);
      case "Communication":
        return isCommunicationWithinDateRange(entry.resource, range);
      case "Composition":
        return isCompositionWithinDateRange(entry.resource, range);
      case "Condition":
        return isConditionWithinDateRange(entry.resource, range);
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
      case "FamilyMemberHistory":
        return isFamilyMemberHistoryWithinDateRange(entry.resource, range);
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
        return isProcedureWithinDateRange(entry.resource, range);
      case "Provenance":
        return isProvenanceWithinDateRange(entry.resource, range);
      case "RelatedPerson":
        return isRelatedPersonWithinDateRange(entry.resource, range);
    }
    return includeIfNoDate;
  });
  return {
    ...bundle,
    entry: filteredEntries ?? [],
  };
}

function isAllergyIntoleranceWithinDateRange(
  resource: AllergyIntolerance,
  range: DateRange
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
    const res = isDateWithinDateRange(resource.onsetString, range);
    if (res !== undefined) return res;
  }
  if (resource.onsetDateTime) {
    const res = isDateWithinDateRange(resource.onsetDateTime, range);
    if (res !== undefined) return res;
  }
  if (resource.lastOccurrence) {
    const res = isDateWithinDateRange(resource.lastOccurrence, range);
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

function isConditionWithinDateRange(resource: Condition, range: DateRange): boolean {
  if (resource.onsetPeriod) {
    const res = arePeriodsWithinRange([resource.onsetPeriod], range);
    if (res !== undefined) return res;
  }
  if (resource.onsetRange) {
    const res = areRangesWithinRange([resource.onsetRange], range);
    if (res !== undefined) return res;
  }
  if (resource.onsetString) {
    const res = isDateWithinDateRange(resource.onsetString, range);
    if (res !== undefined) return res;
  }
  if (resource.onsetDateTime) {
    const res = isDateWithinDateRange(resource.onsetDateTime, range);
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

function isFamilyMemberHistoryWithinDateRange(
  resource: FamilyMemberHistory,
  range: DateRange
): boolean {
  if (resource.condition) {
    const periods = resource.condition.map(c => c.onsetPeriod);
    const arePeriods = arePeriodsWithinRange(periods, range);
    if (arePeriods !== undefined) return arePeriods;

    const ranges = resource.condition.map(c => c.onsetRange);
    const areRanges = areRangesWithinRange(ranges, range);
    if (areRanges !== undefined) return areRanges;

    const dates = resource.condition.flatMap(c => safeDate(c.onsetString) ?? []);
    const areDates = areDatesWithinRange(dates, range);
    if (areDates !== undefined) return areDates;
  }
  if (resource.date) {
    const res = areDatesWithinRange([resource.date], range);
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
  const res = isDateWithinDateRange(resource.startDate, range);
  if (res !== undefined) return res;
  return includeIfNoDate;
}

function isImmunizationWithinDateRange(resource: Immunization, range: DateRange): boolean {
  const res = isDateWithinDateRange(resource.occurrenceDateTime, range);
  if (res !== undefined) return res;
  return includeIfNoDate;
}

function isMedicationDispenseWithinDateRange(
  resource: MedicationDispense,
  range: DateRange
): boolean {
  const res = isDateWithinDateRange(resource.whenHandedOver, range);
  if (res !== undefined) return res;
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
  const res = isDateWithinDateRange(resource.effectiveDateTime, range);
  if (res !== undefined) return res;
  return includeIfNoDate;
}

function isMedicationStatementWithinDateRange(
  resource: MedicationStatement,
  range: DateRange
): boolean {
  const res = isDateWithinDateRange(resource.effectiveDateTime, range);
  if (res !== undefined) return res;
  return includeIfNoDate;
}

function isObservationWithinDateRange(resource: Observation, range: DateRange): boolean {
  if (resource.effectiveDateTime) {
    const res = isDateWithinDateRange(resource.effectiveDateTime, range);
    if (res !== undefined) return res;
  }
  if (resource.issued) {
    const res = isDateWithinDateRange(resource.issued, range);
    if (res !== undefined) return res;
  }
  return includeIfNoDate;
}

function isProcedureWithinDateRange(resource: Procedure, range: DateRange): boolean {
  if (resource.performedPeriod) {
    const res = arePeriodsWithinRange([resource.performedPeriod], range);
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
  // not using performedAge b/c it requires a Patient resource do determine DOB
  return includeIfNoDate;
}

function isProvenanceWithinDateRange(resource: Provenance, range: DateRange): boolean {
  const res = isDateWithinDateRange(resource.recorded, range);
  if (res !== undefined) return res;
  return includeIfNoDate;
}

function isRelatedPersonWithinDateRange(resource: RelatedPerson, range: DateRange): boolean {
  const res = isPeriodWithinRange(resource.period, range);
  if (res !== undefined) return res;
  return includeIfNoDate;
}

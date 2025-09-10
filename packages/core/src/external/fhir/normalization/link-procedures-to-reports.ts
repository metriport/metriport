import {
  CodeableConcept,
  Coding,
  DiagnosticReport,
  Procedure,
  Reference,
  Resource,
} from "@medplum/fhirtypes";
import { buildDayjs } from "@metriport/shared/common/date";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import {
  getPerformedDateFromResource,
  getDateFromResource,
  isUselessDisplay,
} from "../../../fhir-deduplication/shared";
import { toArray } from "@metriport/shared/common/array";
import { createReference, deepClone } from "@medplum/core";

dayjs.extend(duration);

export const SIZE_OF_WINDOW = dayjs.duration(2, "hours").asMilliseconds();

// Regex patterns for filtering identifier and code values
const URI_PATTERN = /^(?:urn:|oid:|https?:\/\/)/i; // Matches URIs, OIDs, and HTTP/HTTPS URLs

export function linkProceduresToDiagnosticReports(
  procedures: Procedure[],
  reports: DiagnosticReport[]
): Procedure[] {
  const clonedProcedures = deepClone(procedures);
  const drMap = new Map<string, DiagnosticReport[]>();

  for (const dr of reports) {
    const keys = getKeysForDiagnosticReport(dr);
    for (const k of keys) {
      const prior = drMap.get(k) ?? [];
      prior.push(dr);
      drMap.set(k, prior);
    }
  }

  for (const proc of clonedProcedures) {
    const { dates, procedureKeys } = getKeysAndDatesForProcedure(proc);
    for (const key of procedureKeys) {
      const drs = drMap.get(key);
      if (!drs) continue;
      for (const dr of drs) {
        const drDates = getDateFromDiagnosticReport(dr);
        if (!doAnyDatesMatchThroughWindow(dates, drDates)) {
          continue;
        }
        const ref: Reference<DiagnosticReport> = createReference(dr);
        const existing: Reference<DiagnosticReport>[] = (proc.report ??
          []) as Reference<DiagnosticReport>[];

        if (!existing.some(r => r.reference === ref.reference)) {
          proc.report = [...existing, ref];
        }
      }
    }
  }

  return clonedProcedures;
}

function getKeysForDiagnosticReport(dr: DiagnosticReport): string[] {
  const idVals = getIdentifierValueTokens(dr);
  const codes = getCodeTokensFromCode(dr.code);

  const out: string[] = [];
  for (const v of idVals) out.push(`${v}`);
  for (const c of codes) out.push(`${c}`);
  return dedupe(out);
}

function getKeysAndDatesForProcedure(p: Procedure): { dates: string[]; procedureKeys: string[] } {
  const date = getPerformedDateFromResource(p, "datetime");
  const dates = date ? [date] : [];
  const idVals = getIdentifierValueTokens(p);
  const codes = getCodeTokensFromCode(p.code);

  const out: string[] = [];

  for (const v of idVals) out.push(`${v}`);
  for (const c of codes) out.push(`${c}`);
  const dedupedOut = dedupe(out);
  const dedupedDates = dedupe(dates);
  return { dates: dedupedDates, procedureKeys: dedupedOut };
}

function getDateFromDiagnosticReport(dr: DiagnosticReport): string[] {
  const dates: string[] = [];

  const dateFromResource = getDateFromResource(dr, "datetime");
  if (dateFromResource) {
    dates.push(dateFromResource);
  }

  if (dr.issued) {
    dates.push(dr.issued);
  }

  return [...new Set(dates)];
}

export function doAnyDatesMatchThroughWindow(a: string[] = [], b: string[] = []): boolean {
  if (a.length === 0 || b.length === 0) return false;

  const aDates = a.map(dateStr => buildDayjs(dateStr)).filter(dayjs => dayjs.isValid());

  const bDates = b.map(dateStr => buildDayjs(dateStr)).filter(dayjs => dayjs.isValid());

  if (aDates.length === 0 || bDates.length === 0) return false;

  for (const dateA of aDates) {
    for (const dateB of bDates) {
      const diffInMs = Math.abs(dateA.diff(dateB, "milliseconds"));
      if (diffInMs <= SIZE_OF_WINDOW) return true;
    }
  }

  return false;
}

function getIdentifierValueTokens(dr: Resource): string[] {
  const out: string[] = [];
  if (!("identifier" in dr)) {
    return [];
  }

  const identifiers = toArray(dr.identifier);

  for (const id of identifiers) {
    const value = id.value?.trim();
    if (!value) continue;

    if (isUselessDisplay(value)) continue;
    if (URI_PATTERN.test(value)) continue;
    const noTrailingCaret = removeTrailingCaret(value);
    out.push(noTrailingCaret);
  }
  return dedupe(out);
}

function getCodeTokensFromCode(code?: CodeableConcept): string[] {
  const codings = (code?.coding ?? []).filter((c): c is Coding => !!c?.code);

  const out: string[] = [];
  for (const c of codings) {
    const token = c.code?.trim();
    if (!token || isUselessDisplay(token)) continue;
    if (URI_PATTERN.test(token)) continue;
    out.push(token.toUpperCase());
  }
  return dedupe(out);
}

function dedupe<T>(arr: T[]): T[] {
  return [...new Set(arr)];
}

/**
 * Removes the trailing caret from a string.
 * This is needed because the Procedures identifier values sometimes are stored with a caret at the end.
 * But the DiagnosticReport identifier values are stored without the caret. Resulting in a mismatch.
 * @param s The string to remove the trailing caret from
 * @returns The string with the trailing caret removed
 */
function removeTrailingCaret(s: string): string {
  if (s.endsWith("^")) {
    return s.slice(0, -1);
  }
  return s;
}

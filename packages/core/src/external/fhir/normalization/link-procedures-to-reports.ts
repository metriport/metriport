import { CodeableConcept, Coding, DiagnosticReport, Procedure, Resource } from "@medplum/fhirtypes";
import { buildDayjs } from "@metriport/shared/common/date";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import {
  getPerformedDateFromResource,
  getDateFromResource,
  isUselessDisplay,
} from "../../../fhir-deduplication/shared";
import { toArray } from "@metriport/shared/common/array";
import { deepClone } from "@medplum/core";
import { buildResourceReference } from "../shared";

dayjs.extend(duration);

// The Threshold is the maximum amount of time between a procedure and a diagnostic report that is considered a match. Default is 2 hours.
export const THRESHOLD = dayjs.duration(2, "hours");

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
        if (!doDatesMatch(dates, drDates)) {
          continue;
        }
        const ref = buildResourceReference(dr);
        const existing = proc.report ?? [];
        if (!existing.some(r => r.reference === ref)) {
          proc.report = [...existing, { reference: ref }];
        }
      }
    }
  }

  return clonedProcedures;
}

function getKeysForDiagnosticReport(dr: DiagnosticReport): string[] {
  const idVals = getIdentifierValueTokens(dr);
  const codes = getCodeTokensFromCode(dr.code);

  const keys: Set<string> = new Set();
  for (const v of idVals) keys.add(`${v}`);
  for (const c of codes) keys.add(`${c}`);
  return Array.from(keys);
}

function getKeysAndDatesForProcedure(p: Procedure): { dates: string[]; procedureKeys: string[] } {
  const date = getPerformedDateFromResource(p, "datetime");
  const dates = date ? [date] : [];
  const idVals = getIdentifierValueTokens(p);
  const codes = getCodeTokensFromCode(p.code);

  const keys: Set<string> = new Set();

  for (const v of idVals) keys.add(`${v}`);
  for (const c of codes) keys.add(`${c}`);
  return { dates: dates, procedureKeys: Array.from(keys) };
}

function getDateFromDiagnosticReport(dr: DiagnosticReport): string[] {
  const dates: Set<string> = new Set();

  const dateFromResource = getDateFromResource(dr, "datetime");
  if (dateFromResource) {
    dates.add(dateFromResource);
  }

  if (dr.issued) {
    dates.add(dr.issued);
  }

  return Array.from(dates);
}

export function doDatesMatch(a: string[] = [], b: string[] = []): boolean {
  if (a.length === 0 || b.length === 0) return false;
  const aDates = a.map(dateStr => buildDayjs(dateStr)).filter(dayjs => dayjs.isValid());
  const bDates = b.map(dateStr => buildDayjs(dateStr)).filter(dayjs => dayjs.isValid());
  if (aDates.length === 0 || bDates.length === 0) return false;

  for (const dateA of aDates) {
    for (const dateB of bDates) {
      const diffInMs = Math.abs(dateA.diff(dateB, "milliseconds"));
      if (diffInMs <= THRESHOLD.asMilliseconds()) return true;
    }
  }

  return false;
}

function getIdentifierValueTokens(dr: Resource): string[] {
  const ids: Set<string> = new Set();
  if (!("identifier" in dr)) {
    return [];
  }

  const identifiers = toArray(dr.identifier);

  for (const id of identifiers) {
    const value = id.value?.trim();
    if (!value) continue;

    if (isUselessDisplay(value)) continue;
    const noTrailingCaret = removeTrailingCaret(value);
    ids.add(noTrailingCaret);
  }
  return Array.from(ids);
}

function getCodeTokensFromCode(code?: CodeableConcept): string[] {
  const codings = (code?.coding ?? []).filter((c): c is Coding => !!c?.code);

  const codes: Set<string> = new Set();
  for (const c of codings) {
    const token = c.code?.trim();
    if (!token || isUselessDisplay(token)) continue;
    codes.add(token.toUpperCase());
  }
  return Array.from(codes);
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

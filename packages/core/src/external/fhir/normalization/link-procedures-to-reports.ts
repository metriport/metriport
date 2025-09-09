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

dayjs.extend(duration);

export const SIZE_OF_WINDOW = dayjs.duration(2, "hours").asMilliseconds();

export function linkProceduresToDiagnosticReports(
  procedures: Procedure[],
  reports: DiagnosticReport[]
): { procedures: Procedure[]; reports: DiagnosticReport[] } {
  const drMap = new Map<string, DiagnosticReport[]>();

  for (const dr of reports) {
    const keys = getKeysForDiagnosticReport(dr);
    for (const k of keys) {
      if (!k) continue;
      const prior = drMap.get(k) ?? [];
      prior.push(dr);
      drMap.set(k, prior);
    }
  }

  for (const proc of procedures) {
    const { dates, pKeys } = getKeysAndDatesForProcedure(proc);
    for (const key of pKeys) {
      const hits = key ? drMap.get(key) : undefined;
      if (!hits) continue;
      for (const hit of hits) {
        if (!hit?.id) continue;
        const hitDates = getDateFromDiagnosticReport(hit);
        if (!doAnyDatesMatchThroughWindow(dates, hitDates)) {
          continue;
        }
        const ref: Reference<DiagnosticReport> = { reference: `DiagnosticReport/${hit.id}` };
        const existing: Reference<DiagnosticReport>[] = (proc.report ??
          []) as Reference<DiagnosticReport>[];

        if (!existing.some(r => r.reference === ref.reference)) {
          proc.report = [...existing, ref];
        }
        break;
      }
    }
  }

  return { procedures, reports };
}

function getKeysForDiagnosticReport(dr: DiagnosticReport): string[] {
  const idVals = getIdentifierValueTokens(dr);
  const codes = getCodeTokensFromCode(dr.code);

  const out: string[] = [];
  for (const v of idVals) out.push(`${v}`);
  for (const c of codes) out.push(`${c}`);
  return dedupe(out);
}

function getKeysAndDatesForProcedure(p: Procedure): { dates: string[]; pKeys: string[] } {
  const date = getPerformedDateFromResource(p, "datetime");
  const dates = date ? [date] : [];
  const idVals = getIdentifierValueTokens(p);
  const codes = getCodeTokensFromCode(p.code);

  const out: string[] = [];

  for (const v of idVals) out.push(`${v}`);
  for (const c of codes) out.push(`${c}`);
  const dedupedOut = dedupe(out);
  const dedupedDates = dedupe(dates);
  return { dates: dedupedDates, pKeys: dedupedOut };
}

function getDateFromDiagnosticReport(dr: DiagnosticReport): string[] {
  const dates: string[] = [];

  // Use the shared function for effectiveDateTime and effectivePeriod
  const dateFromResource = getDateFromResource(dr, "datetime");
  if (dateFromResource) {
    dates.push(dateFromResource);
  }

  // Also check the issued field which is specific to DiagnosticReport
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
    if (!id) continue;
    const value = (id.value ?? "").toString().trim();
    if (!value) continue;

    const valueByPipe = getSplitValueByPipe(value);
    if (!valueByPipe) continue;

    if (isUselessDisplay(valueByPipe)) continue;
    if (/^(?:urn:|oid:|https?:\/\/)/i.test(valueByPipe)) continue;
    const noTrailingCaret = removeTrailingCaret(valueByPipe);
    out.push(noTrailingCaret);
  }
  return dedupe(out);
}

function getSplitValueByPipe(value: string): string {
  if (!value.includes("|")) return value;
  const parts = value
    .split("|")
    .map(s => s.trim())
    .filter(Boolean);
  return parts[parts.length - 1] ?? "";
}

function getCodeTokensFromCode(code?: CodeableConcept): string[] {
  const codings = (code?.coding ?? []).filter((c): c is Coding => !!c?.code);

  const out: string[] = [];
  for (const c of codings) {
    const token = (c.code ?? "").toString().trim();
    if (!token || isUselessDisplay(token)) continue;
    if (/^(?:urn:|oid:|https?:\/\/)/i.test(token)) continue;
    out.push(token.toUpperCase());
  }
  return dedupe(out);
}

function dedupe<T>(arr: T[]): T[] {
  return [...new Set(arr)];
}

function removeTrailingCaret(s: string): string {
  if (s.charAt(s.length - 1) === "^") {
    return s.slice(0, s.length - 1);
  }
  return s;
}

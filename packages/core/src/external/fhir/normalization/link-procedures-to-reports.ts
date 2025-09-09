import {
  CodeableConcept,
  Coding,
  DiagnosticReport,
  Procedure,
  Reference,
  Resource,
} from "@medplum/fhirtypes";

const HOURS_FOR_WINDOW = 2;
export const SIZE_OF_WINDOW = HOURS_FOR_WINDOW * 60 * 60 * 1000;

export function linkProceduresToDiagnosticReports(
  procedures: Procedure[],
  reports: DiagnosticReport[]
): { procedures: Procedure[]; reports: DiagnosticReport[] } {
  const drByKey = new Map<string, DiagnosticReport[]>();

  for (const dr of reports) {
    const keys = getKeysForDiagnosticReport(dr);
    for (const k of keys) {
      if (!k) continue;
      const prior = drByKey.get(k) ?? [];
      prior.push(dr);
      drByKey.set(k, prior);
    }
  }

  for (const proc of procedures) {
    const { dates, pKeys } = getKeysAndDatesForProcedure(proc);
    for (const key of pKeys) {
      const hits = key ? drByKey.get(key) : undefined;
      if (!hits) continue;
      for (const hit of hits) {
        if (!hit?.id) continue;
        if (!matchDates(dates, getDate(hit))) {
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
  const idVals = identifierValueTokens(dr);
  const codes = codeTokensFromCode(dr.code);

  const out: string[] = [];
  for (const v of idVals) out.push(`${v}`);
  for (const c of codes) out.push(`${c}`);
  return dedupe(out);
}

function getKeysAndDatesForProcedure(p: Procedure): { dates: string[]; pKeys: string[] } {
  const dates = dateCandidatesFromProcedure(p);
  const idVals = identifierValueTokens(p);
  const codes = codeTokensFromCode(p.code);

  const out: string[] = [];

  for (const v of idVals) out.push(`${v}`);
  for (const c of codes) out.push(`${c}`);
  const dedupedOut = dedupe(out);
  const dedupedDates = dedupe(dates);
  return { dates: dedupedDates, pKeys: dedupedOut };
}

export function matchDates(a: string[] = [], b: string[] = []): boolean {
  if (a.length === 0 || b.length === 0) return false;

  const aTimes = a
    .map(a => {
      return parseDateIntoNumber(a);
    })
    .filter((t): t is number => t !== undefined);

  const bTimes = b
    .map(b => {
      return parseDateIntoNumber(b);
    })
    .filter((t): t is number => t !== undefined);

  if (aTimes.length === 0 || bTimes.length === 0) return false;

  for (const ta of aTimes) {
    for (const tb of bTimes) {
      if (Math.abs(ta - tb) <= SIZE_OF_WINDOW) return true;
    }
  }

  return false;
}

function parseDateIntoNumber(iso?: string): number | undefined {
  if (!iso) return undefined;
  const d = new Date(iso);
  if (Number.isFinite(d.getTime())) return d.getTime();

  const mFull = iso.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  if (mFull) {
    const dd = new Date(`${mFull[0]}.000Z`);
    if (Number.isFinite(dd.getTime())) return dd.getTime();
  }
  const mDate = iso.match(/^\d{4}-\d{2}-\d{2}/);
  if (mDate) {
    const dd = new Date(`${mDate[0]}T00:00:00.000Z`);
    if (Number.isFinite(dd.getTime())) return dd.getTime();
  }
  return undefined;
}

function getDate(dr: DiagnosticReport): string[] {
  const raw = [
    dr.effectiveDateTime,
    dr.effectivePeriod?.start,
    dr.effectivePeriod?.end,
    dr.issued,
  ].filter(Boolean) as string[];
  return [...new Set(raw)];
}

function dateCandidatesFromProcedure(p: Procedure): string[] {
  const raw = [p.performedDateTime, p.performedPeriod?.start, p.performedPeriod?.end].filter(
    Boolean
  ) as string[];
  return dedupe(raw);
}

function identifierValueTokens(dr: Resource): string[] {
  const BAD = new Set(["UNK", "UNKNOWN", "UNSPECIFIED", "NA", "N/A", "NONE", "NO_CODE"]);
  const out: string[] = [];
  if (!("identifier" in dr)) {
    return [];
  }

  const identifiers = Array.isArray(dr.identifier) ? dr.identifier : [dr.identifier];

  for (const id of identifiers) {
    if (!id) continue;
    const value = (id.value ?? "").toString().trim();
    if (!value) continue;

    const valueByPipe = splitValueByPipe(value);
    if (!valueByPipe) continue;

    const valueByDash = splitValueByDash(valueByPipe);

    if (BAD.has(valueByDash.toUpperCase())) continue;
    if (/^(?:urn:|oid:|https?:\/\/)/i.test(valueByDash)) continue;
    const noTrailingCaret = removeTrailingCaret(valueByDash);
    out.push(noTrailingCaret);
  }
  return dedupe(out);
}

function splitValueByPipe(value: string): string {
  if (!value.includes("|")) return value;
  const parts = value
    .split("|")
    .map(s => s.trim())
    .filter(Boolean);
  return parts[parts.length - 1] ?? "";
}

function splitValueByDash(value: string): string {
  const [head = "", tail = ""] = (value ?? "").split("-", 2);
  return head && tail && /^\d+$/.test(head) && /^\d+$/.test(tail) ? head : value ?? "";
}

function codeTokensFromCode(code?: CodeableConcept): string[] {
  const BAD = new Set(["UNK", "UNKNOWN", "UNSPECIFIED", "NA", "N/A", "NONE", "NO_CODE"]);
  const codings = (code?.coding ?? []).filter((c): c is Coding => !!c?.code);

  const out: string[] = [];
  for (const c of codings) {
    const token = (c.code ?? "").toString().trim().toUpperCase();
    if (!token || BAD.has(token)) continue;
    if (/^(?:urn:|oid:|https?:\/\/)/i.test(token)) continue;
    out.push(token);
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

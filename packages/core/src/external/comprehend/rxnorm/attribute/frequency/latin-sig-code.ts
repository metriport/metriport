import { TimingRepeat } from "@medplum/fhirtypes";

export const LATIN_SIG_CODE = [
  "qd",
  "bid",
  "tid",
  "qid",
  "qh",
  "q2h",
  "q4h",
  "q6h",
  "qod",
  "q1d",
  "qw",
  "qm",
  "hs",
  "ac",
  "pc",
] as const;
const LATIN_SIG_CODE_SET = new Set(LATIN_SIG_CODE);
export type LatinSigCode = (typeof LATIN_SIG_CODE)[number];

export function isLatinSigCode(text: string): text is LatinSigCode {
  return LATIN_SIG_CODE_SET.has(text as LatinSigCode);
}

export function getTimingRepeatForLatinSigCode(latinSigCode: LatinSigCode): TimingRepeat {
  return latinSigCodeToTimingRepeat[latinSigCode];
}

const latinSigCodeToTimingRepeat: Record<LatinSigCode, TimingRepeat> = {
  // *quaque die* = once daily
  qd: {
    frequency: 1,
    period: 1,
    periodUnit: "d",
  },
  // *bis in die* = twice daily
  bid: {
    frequency: 2,
    period: 1,
    periodUnit: "d",
  },
  // *ter in die* = three times daily
  tid: {
    frequency: 3,
    period: 1,
    periodUnit: "d",
  },
  // *quater in die* = four times daily
  qid: {
    frequency: 4,
    period: 1,
    periodUnit: "d",
  },
  // *quaque hora* = every hour
  qh: {
    frequency: 1,
    period: 1,
    periodUnit: "h",
  },
  // *quaque 2 horas* = every 2 hours
  q2h: {
    frequency: 1,
    period: 2,
    periodUnit: "h",
  },
  // *quaque 4 horas* = every 4 hours
  q4h: {
    frequency: 1,
    period: 4,
    periodUnit: "h",
  },
  // *quaque 6 horas* = every 6 hours
  q6h: {
    frequency: 1,
    period: 6,
    periodUnit: "h",
  },
  // *quaque 1 dia* = every 1 day
  q1d: {
    frequency: 1,
    period: 1,
    periodUnit: "d",
  },
  // *quaque altera dia* = every other day
  qod: {
    frequency: 1,
    period: 2,
    periodUnit: "d",
  },
  // *quaque week* = every week
  qw: {
    frequency: 1,
    period: 1,
    periodUnit: "wk",
  },
  // *quaque month* = every month
  qm: {
    frequency: 1,
    period: 1,
    periodUnit: "mo",
  },
  // *hora somni* = at bedtime
  hs: {
    timeOfDay: ["22:00:00"],
  },
  // *ante cibum* = before meals
  ac: {
    when: ["AC"],
  },
  // *post cibum* = after meals
  pc: {
    when: ["PC"],
  },
};

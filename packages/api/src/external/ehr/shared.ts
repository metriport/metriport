import { MetriportError } from "@metriport/shared";
import { buildDayjs } from "@metriport/shared/common/date";
import dayjs from "dayjs";
import { Duration } from "dayjs/plugin/duration";

export const delayBetweenPracticeBatches = dayjs.duration(30, "seconds");
export const parallelPractices = 10;
export const parallelPatients = 2;

export enum EhrSources {
  athena = "athenahealth",
  elation = "elation",
}

export type Appointment = {
  cxId: string;
  practiceId: string;
  patientId: string;
};

export function getLookBackTimeRange({ lookBack }: { lookBack: Duration }): {
  startRange: Date;
  endRange: Date;
} {
  const currentDatetime = buildDayjs(new Date());
  const startRange = buildDayjs(currentDatetime).subtract(lookBack).toDate();
  const endRange = buildDayjs(currentDatetime).toDate();
  return {
    startRange,
    endRange,
  };
}

export function getLookForwardTimeRange({ lookForward }: { lookForward: Duration }): {
  startRange: Date;
  endRange: Date;
} {
  const currentDatetime = buildDayjs(new Date());
  const startRange = buildDayjs(currentDatetime).toDate();
  const endRange = buildDayjs(currentDatetime).add(lookForward).toDate();
  return {
    startRange,
    endRange,
  };
}

const MAP_KEY_SEPARATOR = "|||";

export function createPracticeMapKey(cxId: string, practiceId: string): string {
  return `${cxId}${MAP_KEY_SEPARATOR}${practiceId}`;
}

export function parsePracticeMapKey(key: string): { cxId: string; practiceId: string } {
  const [cxId, practiceId] = key.split(MAP_KEY_SEPARATOR);
  if (!cxId || !practiceId) throw new MetriportError(`Invalid map key ${key}`, undefined, { key });
  return { cxId, practiceId };
}

export function createPracticeMap(appointments: Appointment[]): {
  [k: string]: Appointment[];
} {
  const appointmentsByPractice: { [k: string]: Appointment[] } = {};
  appointments.map(appointment => {
    const key = createPracticeMapKey(appointment.cxId, appointment.practiceId);
    if (appointmentsByPractice[key]) {
      appointmentsByPractice[key].push(appointment);
    } else {
      appointmentsByPractice[key] = [appointment];
    }
  });
  return appointmentsByPractice;
}

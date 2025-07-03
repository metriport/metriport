import { BadRequestError } from "@metriport/shared";
import { buildDayjs } from "@metriport/shared/common/date";
import dayjs from "dayjs";
import duration, { Duration } from "dayjs/plugin/duration";

dayjs.extend(duration);

export const maxJitterPracticeBatches = dayjs.duration(15, "seconds");
export const maxJitterPatientBatches = dayjs.duration(1, "seconds");
export const parallelPractices = 10;
export const parallelPatients = 100;

export type Appointment = {
  cxId: string;
  practiceId: string;
  patientId: string;
};

export function getLookBackTimeRange({ lookBack }: { lookBack: Duration }): {
  startRange: Date;
  endRange: Date;
} {
  const currentDatetime = buildDayjs();
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
  const currentDatetime = buildDayjs();
  const startRange = buildDayjs(currentDatetime).toDate();
  const endRange = buildDayjs(currentDatetime).add(lookForward).toDate();
  return {
    startRange,
    endRange,
  };
}

export function getLookForwardTimeRangeWithOffset({
  lookForward,
  offset,
}: {
  lookForward: Duration;
  offset: Duration;
}): {
  startRange: Date;
  endRange: Date;
} {
  const currentDatetime = buildDayjs();
  const startRange = buildDayjs(currentDatetime).add(offset).toDate();
  const endRange = buildDayjs(currentDatetime).add(offset).add(lookForward).toDate();
  if (startRange > endRange) throw new BadRequestError("Start range is greater than end range");
  return {
    startRange,
    endRange,
  };
}

import { buildDayjs } from "@metriport/shared/common/date";
import { Duration } from "dayjs/plugin/duration";

export enum EhrSources {
  athena = "athenahealth",
  elation = "elation",
}

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

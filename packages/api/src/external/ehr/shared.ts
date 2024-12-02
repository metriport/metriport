import { buildDayjs } from "@metriport/shared/common/date";
import { Duration } from "dayjs/plugin/duration";

export enum EhrSources {
  athena = "athenahealth",
  elation = "elation",
}

export function getLookackTimeRange({ lookback }: { lookback: Duration }): {
  startRange: Date;
  endRange: Date;
} {
  const currentDatetime = buildDayjs(new Date());
  const startRange = buildDayjs(currentDatetime).subtract(lookback).toDate();
  const endRange = buildDayjs(currentDatetime).toDate();
  return {
    startRange,
    endRange,
  };
}

export function getLookforwardTimeRange({ lookforward }: { lookforward: Duration }): {
  startRange: Date;
  endRange: Date;
} {
  const currentDatetime = buildDayjs(new Date());
  const startRange = buildDayjs(currentDatetime).toDate();
  const endRange = buildDayjs(currentDatetime).add(lookforward).toDate();
  return {
    startRange,
    endRange,
  };
}

import { buildDayjs } from "@metriport/shared/common/date";
import { Duration } from "dayjs/plugin/duration";

export enum EhrSources {
  athena = "athenahealth",
  elation = "elation",
}

export function getLookackTimeRange({
  lookback,
  log,
}: {
  lookback: Duration;
  log: typeof console.log;
}): {
  startRange: Date;
  endRange: Date;
} {
  const currentDatetime = buildDayjs(new Date());
  const startRange = buildDayjs(currentDatetime).subtract(lookback).toDate();
  const endRange = buildDayjs(currentDatetime).toDate();
  log(`Getting appointments from ${startRange} to ${endRange}`);
  return {
    startRange,
    endRange,
  };
}

export function getLookforwardTimeRange({
  lookforward,
  log,
}: {
  lookforward: Duration;
  log: typeof console.log;
}): {
  startRange: Date;
  endRange: Date;
} {
  const currentDatetime = buildDayjs(new Date());
  const startRange = buildDayjs(currentDatetime).toDate();
  const endRange = buildDayjs(currentDatetime).add(lookforward).toDate();
  log(`Getting appointments from ${startRange} to ${endRange}`);
  return {
    startRange,
    endRange,
  };
}

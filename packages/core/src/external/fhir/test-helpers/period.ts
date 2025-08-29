import { Period } from "@medplum/fhirtypes";
import { buildDayjs } from "@metriport/shared/common/date";
import { dateTime, dateTime2 } from "./example-constants";

export function makePeriod(start?: string | undefined, end?: string | undefined): Period {
  return {
    start: start ? buildDayjs(start).toISOString() : dateTime.start,
    end: end ? buildDayjs(end).toISOString() : dateTime2.start,
  };
}

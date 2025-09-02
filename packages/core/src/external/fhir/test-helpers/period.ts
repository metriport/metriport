import { Period } from "@medplum/fhirtypes";
import { buildDayjs } from "@metriport/shared/common/date";

export const dateTime = {
  start: "2012-01-01T10:00:00.000Z",
};

export const dateTime2 = {
  start: "2014-02-01T10:00:00.000Z",
};

export function makePeriod(start?: string | undefined, end?: string | undefined): Period {
  return {
    start: start ? buildDayjs(start).toISOString() : dateTime.start,
    end: end ? buildDayjs(end).toISOString() : dateTime2.start,
  };
}

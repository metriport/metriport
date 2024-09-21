import { Age } from "@medplum/fhirtypes";
import { buildDayjs } from "@metriport/shared/common/date";
import dayjs from "dayjs";

export function addAgeToDob(age: Age | undefined, dob: string | undefined): string | undefined {
  if (!dob) return undefined;
  if (!age?.value) return undefined;
  const dayjsUnit = ageUnitToDayjsUnit(age.unit);
  if (!dayjsUnit) return undefined; // could try to infer based on the DOB + current date
  return buildDayjs(dob).add(age.value, dayjsUnit).toISOString();
}

function ageUnitToDayjsUnit(unit: string | undefined): dayjs.ManipulateType | undefined {
  if (!unit) return undefined;
  switch (unit) {
    case "a":
    case "year":
    case "years":
      return "year";
    case "mo":
    case "month":
    case "months":
      return "month";
    case "wk":
    case "week":
    case "weeks":
      return "week";
    case "d":
    case "day":
    case "days":
      return "day";
    case "h":
    case "hour":
    case "hours":
      return "hour";
    case "min":
    case "minute":
    case "minutes":
      return "minute";
    default:
      return undefined;
  }
}

import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone";

dayjs.extend(timezone);

export function isValidTimezone(timezone: string): boolean {
  try {
    const sampleDate = "1945-05-09";
    dayjs.tz(sampleDate, timezone);
    return true;
  } catch (error) {
    return false;
  }
}

import { buildDayjs } from "@metriport/shared/common/date";
import dayjs from "dayjs";

export const COMMONWELL_DATE_TIME = "YYYY-MM-DDTHH:mm:ssZ";

export function normalizeDatetime(dateString: Date | dayjs.Dayjs | string): string {
  return buildDayjs(dateString).format(COMMONWELL_DATE_TIME);
}

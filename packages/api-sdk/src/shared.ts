import { ISO_DATE } from "@metriport/shared/common/date";
import dayjs from "dayjs";

export const BASE_ADDRESS = "https://api.metriport.com";
export const BASE_ADDRESS_SANDBOX = "https://api.sandbox.metriport.com";
export const API_KEY_HEADER = "x-api-key";
export const JWT_HEADER = "Authorization";
export const DEFAULT_AXIOS_TIMEOUT_MILLIS = 20_000;

export function optionalDateToISOString(
  date: string | Date | undefined | null
): string | undefined {
  const preConversion = date && typeof date !== "string" ? dayjs(date).format(ISO_DATE) : date;
  return preConversion ?? undefined;
}

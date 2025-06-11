import dayjs from "dayjs";

export function makePatientLoadFileName(
  transmissionId: string,
  timestamp: number,
  usingCompression = false
): string {
  return [
    "Metriport_PMA_",
    dayjs(timestamp).format("YYYYMMDD"), // must be in local time, not UTC
    "-",
    transmissionId,
    usingCompression ? ".gz" : "",
  ].join("");
}

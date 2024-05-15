import dayjs from "dayjs";
import { genderMapping } from "../../fhir/patient";

export function normalizeGender(gender: "M" | "F" | undefined): "male" | "female" | undefined {
  if (gender === undefined) {
    return undefined;
  }
  return genderMapping[gender] ?? undefined;
}

export function timestampToSoapBody(createdTimestamp: string): string {
  return dayjs(createdTimestamp).toISOString();
}

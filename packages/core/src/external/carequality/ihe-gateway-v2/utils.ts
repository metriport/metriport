import dayjs from "dayjs";
import { genderAtBirthMapping, GenderAtBirth } from "../../../domain/patient";

export function normalizeGender(gender: GenderAtBirth | undefined): "male" | "female" | undefined {
  if (gender === undefined) {
    return undefined;
  }
  return genderAtBirthMapping[gender] ?? undefined;
}

export function timestampToSoapBody(createdTimestamp: string): string {
  return dayjs(createdTimestamp).toISOString();
}

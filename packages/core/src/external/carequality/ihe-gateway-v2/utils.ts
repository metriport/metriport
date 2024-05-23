import dayjs from "dayjs";
import { GenderAtBirth } from "../../../domain/patient";
import { mapGenderAtBirthToFhir } from "../../fhir/patient";

export function normalizeGender(gender: GenderAtBirth | undefined): "male" | "female" | undefined {
  if (gender === undefined) {
    return undefined;
  }
  return mapGenderAtBirthToFhir(gender) ?? undefined;
}

export function timestampToSoapBody(createdTimestamp: string): string {
  return dayjs(createdTimestamp).toISOString();
}

export function toArray<T>(input: T | T[]): T[] {
  if (input == undefined) {
    return [];
  }
  return Array.isArray(input) ? input : [input];
}

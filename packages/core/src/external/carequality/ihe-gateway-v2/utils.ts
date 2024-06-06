import dayjs from "dayjs";
import { GenderAtBirth } from "../../../domain/patient";
import { mapGenderAtBirthToFhir } from "../../fhir/patient";
import { TextOrTextObject } from "./schema";

export function normalizeGender(gender: GenderAtBirth | undefined): "male" | "female" | undefined {
  if (gender === undefined) {
    return undefined;
  }
  const mappedGender = mapGenderAtBirthToFhir(gender);
  if (mappedGender === "other" || mappedGender === "unknown") {
    return undefined;
  }
  return mappedGender;
}

export function timestampToSoapBody(createdTimestamp: string): string {
  return dayjs(createdTimestamp).toISOString();
}

export function toArray<T>(input: T | T[] | "" | undefined): T[] {
  if (input == undefined || input === "") {
    return [];
  }
  return Array.isArray(input) ? input : [input];
}

export const extractText = (textOrTextObject: TextOrTextObject): string => {
  if (typeof textOrTextObject === "string") {
    return textOrTextObject;
  }
  return textOrTextObject._text;
};

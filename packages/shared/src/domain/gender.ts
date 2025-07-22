import { BadRequestError } from "../error/bad-request";

export const maleGender = "M";
export const femaleGender = "F";
export const otherGender = "O";
export const unknownGender = "U";

export type GenderAtBirth =
  | typeof maleGender
  | typeof femaleGender
  | typeof otherGender
  | typeof unknownGender;

export function genderOtherAsUnknown(gender: GenderAtBirth): GenderAtBirth {
  return gender === otherGender ? unknownGender : gender;
}

export function normalizeGenderSafe(gender: string): GenderAtBirth | undefined {
  const lowerGender = gender.toLowerCase().trim();
  if (lowerGender === "male" || lowerGender === "m") {
    return maleGender;
  } else if (lowerGender === "female" || lowerGender === "f") {
    return femaleGender;
  } else if (lowerGender === "other" || lowerGender === "un" || lowerGender === "o") {
    return otherGender;
  } else if (lowerGender === "unknown" || lowerGender === "unk" || lowerGender === "u") {
    return unknownGender;
  }
  return undefined;
}

export function normalizeGender(gender: string): GenderAtBirth {
  const genderOrUndefined = normalizeGenderSafe(gender);
  if (!genderOrUndefined) throw new BadRequestError("Invalid gender", undefined, { gender });
  return genderOrUndefined;
}

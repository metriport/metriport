export type GenderAtBirth = "F" | "M" | "O" | "U";

function noramlizeGenderBase(gender: string): string {
  return gender.toLowerCase().trim();
}

export function normalizeGenderSafe(
  gender: string,
  normalizeBase: (gender: string) => string = noramlizeGenderBase
): "F" | "M" | "O" | "U" | undefined {
  const baseGender = normalizeBase(gender);
  if (baseGender === "male" || baseGender === "m") {
    return "M";
  } else if (baseGender === "female" || baseGender === "f") {
    return "F";
  } else if (baseGender === "other" || baseGender === "un" || baseGender === "o") {
    return "O";
  } else if (baseGender === "unknown" || baseGender === "unk" || baseGender === "u") {
    return "U";
  }
  return undefined;
}

export function normalizeGender(gender: string): GenderAtBirth {
  const genderOrUndefined = normalizeGenderSafe(gender);
  if (!genderOrUndefined) throw new Error("Invalid gender");
  return genderOrUndefined;
}

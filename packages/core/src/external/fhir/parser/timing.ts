import { Timing } from "@medplum/fhirtypes";

const wordToFrequency: Record<string, number> = {
  day: 1,
  week: 7,
  month: 30,
  year: 365,
};

export function parseTimingFromString(timingString: string): Timing | undefined {
  const words = timingString.trim().toLowerCase().split(" ");
  if (words.length === 0) return undefined;

  const firstWord = words[0];
  if (firstWord === "every") {
    const secondWord = words[1];
    if (!secondWord) return undefined;

    const frequency = wordToFrequency[secondWord];
    if (!frequency) return undefined;

    return {
      repeat: {
        frequency,
        period: 1,
        periodUnit: "d",
      },
    };
  }

  return undefined;
}

import { Timing } from "@medplum/fhirtypes";
import { buildParserExtension } from "./extension";

const wordToFrequency: Record<string, number> = {
  day: 1,
  week: 7,
  month: 30,
  year: 365,
};

export function parseTiming(timingString: string): Timing | undefined {
  const words = timingString.trim().toLowerCase().split(" ");
  if (words.length === 0) return undefined;

  const firstWord = words[0];
  if (firstWord === "every") {
    const secondWord = words[1];
    if (!secondWord) return undefined;

    const frequency = wordToFrequency[secondWord];
    if (!frequency) return undefined;

    const parserExtension = buildParserExtension(timingString);

    return {
      repeat: {
        frequency,
        period: 1,
        periodUnit: "d",
      },
      extension: [parserExtension],
    };
  }

  return undefined;
}

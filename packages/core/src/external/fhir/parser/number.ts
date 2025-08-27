export function parseNumber(inputString: string): { value?: number; remainder: string } {
  const [firstPart, ...remainder] = inputString.trim().split(" ");

  if (firstPart) {
    const intValue = parseNumberFromWord(firstPart);
    if (intValue == null) return { remainder: inputString };

    // Check for additional number modifiers and words
    if (remainder && remainder.length > 0) {
      while (remainder[0] === "and") {
        remainder.splice(0, 1);
      }
      const { value, remainder: finalRemainder } = parseNumber(remainder.join(" "));
      // Handles the case of "one thousand", "one hundred and one"
      if (value != null) {
        return { value: intValue * value, remainder: finalRemainder };
      }
      return { remainder: inputString };
    }
  }

  return { remainder: inputString };
}

function parseNumberFromWord(word: string): number | undefined {
  const numberNameValue = numberName[word];
  if (numberNameValue) return numberNameValue;

  const floatValue = Number.parseFloat(word);
  if (Number.isFinite(floatValue)) return floatValue;

  return undefined;
}

const numberName: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
  hundred: 100,
  "one hundred": 100,
  thousand: 1000,
  million: 1000000,
};

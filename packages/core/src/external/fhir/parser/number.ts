interface NumberParserResult {
  value?: number;
  remainder: string;
}

export function parseNumber(inputString: string): NumberParserResult {
  const [token, remainder] = getFirstToken(inputString);

  if (isFirstWordOfNumber(token)) {
    const result = parseNumberFromWord(token, remainder);
    if (result != null) {
      return result;
    }
  }

  // If the first part is a numeric value, return it as-is without searching any remaining parts
  const value = parseNumericValueFromToken(token);
  if (value != null) {
    return { value, remainder };
  }

  return { remainder: inputString };
}

function parseNumberFromWord(token: string, remainder: string): NumberParserResult | undefined {
  const firstWordOfNumber = token.toLowerCase();
  if (!isFirstWordOfNumber(firstWordOfNumber)) {
    return undefined;
  }
  const singleNumber = parseSingleNumberFromWord(firstWordOfNumber, remainder);
  if (singleNumber != null) {
    return singleNumber;
  }
  const tenNumber = parseTenNumberFromWord(firstWordOfNumber, remainder);
  if (tenNumber != null) {
    return tenNumber;
  }
  // TODO: add additional cases for parsing numbers from words
  return undefined;
}

function parseSingleNumberFromWord(
  firstWordOfNumber: string,
  remainder: string
): NumberParserResult | undefined {
  const singleNumber = singleNumberName[firstWordOfNumber];
  if (singleNumber != null) {
    const scaleModifier = parseScaleModifier(remainder);
    if (scaleModifier != null) {
      return { value: singleNumber * scaleModifier, remainder };
    }
    return { value: singleNumber, remainder };
  }
  return undefined;
}

function parseTenNumberFromWord(
  firstWordOfNumber: string,
  remainder: string
): NumberParserResult | undefined {
  const tenNumber = tenNumberName[firstWordOfNumber];
  if (tenNumber != null) {
    const scaleModifier = parseScaleModifier(remainder);
    if (scaleModifier != null) {
      return { value: tenNumber * scaleModifier, remainder };
    }
    return { value: tenNumber, remainder };
  }
  return undefined;
}

function getFirstToken(inputString: string): [string, string] {
  const firstSpace = inputString.trim().indexOf(" ");
  if (firstSpace === -1) return [inputString, ""];
  return [inputString.slice(0, firstSpace).trim(), inputString.slice(firstSpace + 1).trim()];
}

function isFirstWordOfNumber(token: string): boolean {
  const lowercasedToken = token.toLowerCase();
  return singleNumberName[lowercasedToken] != null || tenNumberName[lowercasedToken] != null;
}

function parseNumericValueFromToken(token: string): number | undefined {
  const floatValue = Number.parseFloat(token);
  if (Number.isFinite(floatValue)) return floatValue;
  return undefined;
}

function parseScaleModifier(inputString: string): number | undefined {
  const [token] = getFirstToken(inputString);
  const scaleModifier = numberScaleName[token];
  if (scaleModifier) return scaleModifier;
  return undefined;
}

const singleNumberName: Record<string, number> = {
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
};

const tenNumberName: Record<string, number> = {
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
};

const numberScaleName: Record<string, number> = {
  hundred: 100,
  thousand: 1000,
  million: 1000000,
  billion: 1000000000,
  trillion: 1000000000000,
};

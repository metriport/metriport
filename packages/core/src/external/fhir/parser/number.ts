interface NumberParserResult {
  value?: number;
  remainder: string;
}

export function parseNumber(inputString: string): NumberParserResult {
  // First try parsing word numbers like "one hundred and five"
  const wordResult = parseNumberFromWord(inputString);
  if (wordResult != null) {
    return wordResult;
  }

  // Then try parsing numeric values like "123"
  const digitResult = parseNumberFromDigits(inputString);
  if (digitResult != null) {
    return digitResult;
  }

  return { remainder: inputString };
}

/**
 * Parses a number from digits at the beginning of the input string.
 */
function parseNumberFromDigits(inputString: string): NumberParserResult | undefined {
  const [token, remainder] = getFirstToken(inputString);
  const value = Number.parseFloat(token);
  if (Number.isFinite(value)) {
    return { value, remainder };
  }
  return undefined;
}

/**
 * Parses any word-based number from the input string
 */
function parseNumberFromWord(inputString: string): NumberParserResult | undefined {
  const [token, remainder] = getFirstToken(inputString);
  const firstWordOfNumber = token.toLowerCase();
  if (!isFirstWordOfNumber(firstWordOfNumber)) {
    return undefined;
  }
  // Attempt to parse a single number component like "one", "two hundred", etc.
  let result: NumberParserResult | undefined = parseSimpleWordNumber(firstWordOfNumber, remainder);
  if (result === undefined) result = parseSingleNumberFromWord(firstWordOfNumber, remainder);
  if (result === undefined) result = parseTenNumberFromWord(firstWordOfNumber, remainder);
  if (!result || result.value == null) return undefined;

  // Attempt to add a subsequent number component to handle cases like "two hundred thirty four"
  const nextResult = parseNumberFromWord(result.remainder);
  if (shouldAddResult(result, nextResult)) {
    result.value += nextResult.value;
    result.remainder = nextResult.remainder;
  }
  return result;
}

function shouldAddResult(
  result: NumberParserResult,
  nextResult?: NumberParserResult
): nextResult is Required<NumberParserResult> {
  if (!nextResult || result.value == null || nextResult.value == null) return false;
  const resultScale = result.value.toString().length;
  const nextResultScale = nextResult.value.toString().length;
  return resultScale > nextResultScale;
}

function parseSimpleWordNumber(token: string, remainder: string): NumberParserResult | undefined {
  const digitNumber = simpleNumberName[token];
  if (digitNumber === undefined) return undefined;

  // Handles cases like "one hundred", "two thousand", etc.
  const [nextWord, nextRemainder] = getFirstToken(remainder);
  const scaleModifier = numberScaleName[nextWord];
  if (scaleModifier) {
    return { value: digitNumber * scaleModifier, remainder: nextRemainder };
  }

  // Otherwise the value is a regular digit like "one"
  return { value: digitNumber, remainder };
}

function parseScaleModifier(inputString: string): number | undefined {
  const [token] = getFirstToken(inputString);
  const scaleModifier = numberScaleName[token];
  if (scaleModifier) return scaleModifier;
  return undefined;
}

function parseSingleNumberFromWord(
  firstWordOfNumber: string,
  remainder: string
): NumberParserResult | undefined {
  const singleNumber = doubleDigitNumberName[firstWordOfNumber];
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
    const [nextWord, nextRemainder] = getFirstToken(remainder);
    const nextSingleNumber = parseSingleNumberFromWord(nextWord, nextRemainder);
    if (nextSingleNumber != null) {
      console.log("nextSingleNumber", nextSingleNumber);
    }

    const scaleModifier = parseScaleModifier(remainder);
    if (scaleModifier != null) {
      return { value: tenNumber * scaleModifier, remainder };
    }
    return { value: tenNumber, remainder };
  }
  return undefined;
}

function getFirstToken(inputString: string): [string, string] {
  const matchFirstPart = inputString.trim().match(/^([a-zA-Z0-9.]+)\b\s*(.*)/);
  if (matchFirstPart === null) return [inputString, ""];
  const firstToken = matchFirstPart[1];
  const remainder = matchFirstPart[2];
  if (firstToken === undefined || remainder === undefined) return [inputString, ""];
  return [firstToken, remainder];
}

function isFirstWordOfNumber(token: string): boolean {
  const lowercasedToken = token.toLowerCase();
  return (
    simpleNumberName[lowercasedToken] != null || doubleDigitNumberName[lowercasedToken] != null
  );
}

const simpleNumberName: Record<string, number> = {
  zero: 0,
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

const doubleDigitNumberName: Record<string, number> = {
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
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

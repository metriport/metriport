import { getFirstToken } from "./shared";

interface NumberParserResult {
  value: number;
  remainder: string;
  scaleModifier?: boolean;
}

export function parseNumber(inputString: string): NumberParserResult | undefined {
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

  return undefined;
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
function parseNumberFromWord(
  inputString: string,
  shouldParseScaleModifier = true
): NumberParserResult | undefined {
  const [token, remainder] = getFirstToken(inputString);
  const firstWordOfNumber = token.toLowerCase();

  if (shouldParseScaleModifier && isScaleModifier(firstWordOfNumber)) {
    return parseScaleModifier(inputString);
  } else if (isFirstWordOfNumber(firstWordOfNumber)) {
    // Attempt to parse a single number component like "one", "two hundred", etc.
    const result = parseSimpleWordNumber(firstWordOfNumber, remainder);
    if (!result) return undefined;

    // Attempt to recursively add subsequent smaller number components to handle cases like "two hundred thirty four"
    let nextResult: NumberParserResult | undefined = undefined;
    do {
      nextResult = parseNumberFromWord(result.remainder);
      if (nextResult && shouldAddResult(result, nextResult)) {
        result.value += nextResult.value;
        result.remainder = nextResult.remainder;

        // Handle intermittent scale modifiers like "two hundred thirty four thousand"
        const scaleModifier = parseScaleModifier(nextResult.remainder);
        if (scaleModifier != null) {
          result.value *= scaleModifier.value;
          result.remainder = scaleModifier.remainder;
        } else break;
      } else break;
    } while (nextResult != null);

    return result;
  } else return undefined;
}

function shouldAddResult(result: NumberParserResult, nextResult?: NumberParserResult): boolean {
  if (!nextResult || result.value == null || nextResult.value == null) return false;
  const resultScale = result.value.toString().length;
  const nextResultScale = nextResult.value.toString().length;
  return resultScale > nextResultScale;
}

function parseSimpleWordNumber(token: string, remainder: string): NumberParserResult | undefined {
  const digitNumber = simpleNumberName[token];
  if (digitNumber === undefined) return undefined;

  // Handles scaled numbers like "one hundred", "two thousand", etc.
  const scaleModifier = parseScaleModifier(remainder);
  if (scaleModifier != null) {
    return { value: digitNumber * scaleModifier.value, remainder: scaleModifier.remainder };
  }

  // Otherwise the value is a regular digit like "one"
  return { value: digitNumber, remainder };
}

export function parseScaleModifier(inputString: string): NumberParserResult | undefined {
  const [token, remainder] = getFirstToken(inputString);
  const value = numberScaleName[token];
  if (value != null) return { value, remainder, scaleModifier: true };
  return undefined;
}

function isFirstWordOfNumber(token: string): boolean {
  const lowercasedToken = token.toLowerCase();
  return simpleNumberName[lowercasedToken] != null;
}

function isScaleModifier(token: string): boolean {
  const lowercasedToken = token.toLowerCase();
  return numberScaleName[lowercasedToken] != null;
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

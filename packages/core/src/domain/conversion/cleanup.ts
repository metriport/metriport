export const xmlTranslationCodeRegex = /(<translation[^>]*\scode=")([^"]*?)(")/g;

export const LESS_THAN = "&lt;";
export const GREATER_THAN = "&gt;";
const AMPERSAND = "&amp;";
const UNESCAPED_AMPERSAND_REGEX =
  /&(?!((?:lt|gt|amp|quot|apos|nbsp|ndash|mdash|copy|reg|trade|bullet);|#[0-9]+;|#x[0-9A-Fa-f]+;))/g;

export function cleanUpPayload(payloadRaw: string): string {
  const payloadNoCdUnk = replaceCdUnkString(payloadRaw);
  const payloadNoAmpersand = replaceAmpersand(payloadNoCdUnk);
  const payloadNoInvalidTagChars = replaceXmlTagChars(payloadNoAmpersand);
  const payloadNoNullFlavor = replaceNullFlavor(payloadNoInvalidTagChars);
  const payloadCleanedCode = cleanUpTranslationCode(payloadNoNullFlavor);
  return payloadCleanedCode;
}

function replaceCdUnkString(payloadRaw: string): string {
  const stringToReplace = /xsi:type="CD UNK"/g;
  const replacement = `xsi:type="CD"`;
  return payloadRaw.replace(stringToReplace, replacement);
}

function replaceNullFlavor(payloadRaw: string): string {
  const stringToReplace = /<id\s*nullFlavor\s*=\s*".*?"\s*\/>/g;
  const replacement = `<id extension="1" root="1"/>`;
  return payloadRaw.replace(stringToReplace, replacement);
}

export function replaceAmpersand(payloadRaw: string): string {
  return payloadRaw.replace(UNESCAPED_AMPERSAND_REGEX, AMPERSAND);
}

export function replaceXmlTagChars(doc: string): string {
  const chars = Array.from(doc);

  let stringState = true;
  let startTagState = 0;
  for (let i = 0; i < chars.length; i++) {
    const c = chars[i];

    if (stringState) {
      if (c == ">") {
        chars[i] = "&gt;";
      } else if (c == "<") {
        stringState = false;
        startTagState = i;
      }
    }
    // tag state
    else {
      if (c == ">") {
        stringState = true;
      } else if (c == "<") {
        chars[startTagState] = "&lt;";
        startTagState = i;
      }
    }
  }
  return chars.join("");
}

export function cleanUpTranslationCode(payloadRaw: string): string {
  return payloadRaw.replace(xmlTranslationCodeRegex, (_, prefix, code, suffix) => {
    const cleanedCode = code.split("\\")[0].trim();
    return `${prefix}${cleanedCode}${suffix}`;
  });
}

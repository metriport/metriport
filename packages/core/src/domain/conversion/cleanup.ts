export const xmlTranslationCodeRegex = /(<translation[^>]*\scode=")([^"]*?)(")/g;

export const LESS_THAN = "&lt;";
const AMPERSAND = "&amp;";

export function cleanUpPayload(payloadRaw: string): string {
  const payloadNoCdUnk = replaceCdUnkString(payloadRaw);
  const payloadNoAmpersand = replaceAmpersand(payloadNoCdUnk);
  const payloadNoLessThan = replaceLessThanChar(payloadNoAmpersand);
  const payloadNoNullFlavor = replaceNullFlavor(payloadNoLessThan);
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

function replaceAmpersand(payloadRaw: string): string {
  const stringToReplace = /\s&\s/g;
  const replacement = ` ${AMPERSAND} `;
  return payloadRaw.replace(stringToReplace, replacement);
}

/**
 * Replacing some instances of `<` where it happens inside the string values of the XML.
 *
 * Not replacing `>X` and `> X` because those might happen naturally, i.e. in lists `<td>1.`, etc.
 */
export function replaceLessThanChar(payloadRaw: string): string {
  const lessPattern = /\s<\s|\s*<\s*(?=\d)/g;
  return payloadRaw.replace(lessPattern, ` ${LESS_THAN} `);
}

export function cleanUpTranslationCode(payloadRaw: string): string {
  return payloadRaw.replace(xmlTranslationCodeRegex, (_, prefix, code, suffix) => {
    const cleanedCode = code.split("\\")[0].trim();
    return `${prefix}${cleanedCode}${suffix}`;
  });
}

export const xmlTranslationCodeRegex = /(<translation[^>]*\scode=")([^"]*?)(")/g;

export function cleanUpPayload(payloadRaw: string): string {
  const payloadNoCdUnk = replaceCdUnkString(payloadRaw);
  const payloadNoAmpersand = replaceAmpersand(payloadNoCdUnk);
  const payloadNoNullFlavor = replaceNullFlavor(payloadNoAmpersand);
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
  const replacement = " &amp; ";
  return payloadRaw.replace(stringToReplace, replacement);
}

export function cleanUpTranslationCode(payloadRaw: string): string {
  return payloadRaw.replace(xmlTranslationCodeRegex, (_, prefix, code, suffix) => {
    const cleanedCode = code.split("\\")[0].trim();
    return `${prefix}${cleanedCode}${suffix}`;
  });
}

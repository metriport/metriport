export function cleanUpPayload(payloadRaw: string): string {
  const payloadNoCdUnk = replaceCdUnkString(payloadRaw);
  const payloadNoNullFlavor = replaceNullFlavor(payloadNoCdUnk);
  return payloadNoNullFlavor;
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

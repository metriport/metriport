export function cleanUpPayload(payloadRaw: string): string {
  const payloadNoCDUNK = removeCDUNK(payloadRaw);
  const payloadNoNullFlavor = removeNullFlavor(payloadNoCDUNK);
  return payloadNoNullFlavor;
}

function removeCDUNK(payloadRaw: string): string {
  const stringToReplace = /xsi:type="CD UNK"/g;
  const replacement = `xsi:type="CD"`;
  return payloadRaw.replace(stringToReplace, replacement);
}

function removeNullFlavor(payloadRaw: string): string {
  const stringToReplace = /<id\s*nullFlavor\s*=\s*".*?"\s*\/>/g;
  const replacement = `<id extension="1" root="1"/>`;
  return payloadRaw.replace(stringToReplace, replacement);
}

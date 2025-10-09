export function getFirstToken(inputString: string): [string, string] {
  const matchFirstPart = inputString
    .trim()
    .match(/^\s*-?(\/|=|[a-zA-Z0-9]+|[-\d.,]+)\b(-?|\s*)(.*)/);
  if (matchFirstPart === null) return [inputString, ""];
  const firstToken = matchFirstPart[1];
  const remainder = matchFirstPart[3];
  if (firstToken === undefined || remainder === undefined) return [inputString, ""];
  return [firstToken, remainder];
}

export function getFirstNumericToken(inputString: string): [string, string] {
  const matchFirstPart = inputString.trim().match(/^\s*([-\d.,]+)\b(.*)/);
  if (matchFirstPart === null) return [inputString, ""];
  const firstToken = matchFirstPart[1];
  const remainder = matchFirstPart[2];
  if (firstToken === undefined || remainder === undefined) return [inputString, ""];
  return [firstToken, remainder];
}

export function generateTimeStrings(): {
  createdAt: string;
  expiresAt: string;
  creationTime: string;
} {
  const now = new Date();

  const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours from now

  const createdAt = now.toISOString();
  const expiresAtStr = expiresAt.toISOString();

  // Get timezone offset in minutes
  const timezoneOffset = now.getTimezoneOffset();
  const timezoneOffsetHours = Math.floor(Math.abs(timezoneOffset) / 60);
  const timezoneOffsetMinutes = Math.abs(timezoneOffset) % 60;

  // Format timezone offset as "+HHMM" or "-HHMM"
  const timezoneOffsetStr =
    (timezoneOffset > 0 ? "-" : "+") +
    String(timezoneOffsetHours).padStart(2, "0") +
    String(timezoneOffsetMinutes).padStart(2, "0");

  // Format the creationTime in the required format
  const creationTime = now.toISOString().replace(/-|:|\.\d{3}/g, "") + timezoneOffsetStr;

  return { createdAt, expiresAt: expiresAtStr, creationTime };
}

export function cleanXml(xml: string): string {
  xml = xml.trim();
  xml = xml.replace(/^\\n/, "");
  // all the different escape permutations I have seen
  xml = xml.replace(/\\\\\\\\"/g, '"');
  xml = xml.replace(/\\\\\\"/g, '"');
  xml = xml.replace(/\\\\"/g, '"');
  xml = xml.replace(/\\"/g, '"');
  return xml;
}

export function parseMtomResponseRegex(body: string): string {
  const envelopeTags = ["soap:Envelope", "s:Envelope", "soapenv:Envelope"];
  //eslint-disable-next-line
  const regex = new RegExp(`(<(${envelopeTags.join("|")}).*<\/(${envelopeTags.join("|")})>)`, "s");
  const match = body.match(regex);

  if (match && match[1]) {
    return match[1];
  }

  console.log("No valid XML envelope found in the body");
  return body;
}

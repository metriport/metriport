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
  xml = xml.replace(/\\\\\\"/g, '"');
  xml = xml.replace(/\\"/g, '"');
  return xml;
}

interface ParsedContentType {
  boundary: string;
  startToken: string;
}

function parseContentTypeHeader(header: string): ParsedContentType | undefined {
  console.log("header", header);
  const boundaryMatch = header.match(/boundary="([^"]+)"/);
  const startTokenMatch = header.match(/start="<([^"]+)>"/);
  console.log("boundaryMatch", boundaryMatch);
  console.log("startTokenMatch", startTokenMatch);
  if (!boundaryMatch || !startTokenMatch || !boundaryMatch[1] || !startTokenMatch[1]) {
    return undefined;
  }
  return {
    boundary: boundaryMatch[1],
    startToken: startTokenMatch[1],
  };
}

function extractXmlFromBody(body: string, contentType: ParsedContentType): string | undefined {
  console.log("contentType", contentType);
  const parts = body.split(`--${contentType.boundary}`);
  for (const part of parts) {
    if (part.includes(`Content-ID: <${contentType.startToken}>`)) {
      const xmlStartIndex =
        part.indexOf("<soap:Envelope") >= 0
          ? part.indexOf("<soap:Envelope")
          : part.indexOf("<s:Envelope");
      if (xmlStartIndex >= 0) {
        const xmlContent = part.substring(xmlStartIndex);
        return xmlContent.split("\r\n")[0] ?? undefined;
      }
    }
  }
  return undefined;
}

export function parseMtomResponse(body: string, contentTypeHeader: string): string {
  const parsedContentType = parseContentTypeHeader(contentTypeHeader);
  if (!parsedContentType) {
    console.error("Invalid or unsupported Content-Type header");
    return body;
  }
  const extractedXml = extractXmlFromBody(body, parsedContentType);
  return extractedXml ?? body;
}

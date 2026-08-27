const boundary = "MIMEBoundary782a6cafc4cf4aab9dbf291522804454";
const contentId = "<doc0@metriport.com>";
const carriageReturn = "\r\n";

export function createMtomContentTypeAndPayload(signedXml: string): {
  contentType: string;
  payload: Buffer;
} {
  const contentType = `multipart/related; boundary=${boundary}; type="application/xop+xml"; start="${contentId}"; start-info="application/soap+xml"; action="urn:ihe:iti:2007:CrossGatewayRetrieve"`;
  const payload = `--${boundary}${carriageReturn}Content-ID: ${contentId}${carriageReturn}Content-Type: application/xop+xml; charset=UTF-8; type="application/soap+xml"${carriageReturn}Content-Transfer-Encoding: 8bit${carriageReturn}${carriageReturn}${signedXml}${carriageReturn}${carriageReturn}--${boundary}--`;
  return { contentType, payload: Buffer.from(payload) };
}

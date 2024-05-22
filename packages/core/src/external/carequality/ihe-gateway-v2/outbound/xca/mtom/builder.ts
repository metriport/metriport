const boundary = "MIMEBoundary782a6cafc4cf4aab9dbf291522804454";
const contentId = "<doc0@metriport.com>";
const carriageReturn = "\r\n";
export function creatMtomContentTypeAndPayload(signedXml: string): {
  contentType: string;
  payload: string;
} {
  const contentType = `multipart/related; type="application/xop+xml"; start="${contentId}"; boundary=${boundary}; start-info="application/soap+xml"`;
  const payload = `--${boundary}${carriageReturn}Content-ID: ${contentId}${carriageReturn}Content-Type: application/xop+xml; charset=UTF-8; type="application/soap+xml"${carriageReturn}Content-Transfer-Encoding: 8bit${carriageReturn}${carriageReturn}${signedXml}${carriageReturn}${carriageReturn}--${boundary}--`;
  return { contentType, payload };
}

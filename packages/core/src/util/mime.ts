/**
 * Returns boolean indicating whether a given MIME type is XML.
 * This takes into consideration of our usage of XMLs, which based on "pure"
 * XMLs. This is because there are specific application formats that add
 * "+xml" to the end of their MIME type, which were not considering here.
 * Examples: "application/xhtml+xml", "application/atom+xml".
 * See: https://en.wikipedia.org/wiki/XML_and_MIME
 */
export function isMimeTypeXML(mimeType?: string | undefined | null): boolean {
  return mimeType === "application/xml" || mimeType === "text/xml";
}

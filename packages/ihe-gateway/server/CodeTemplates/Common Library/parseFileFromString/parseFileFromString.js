/**
 * @typedef {Object} ParsedFile
 * @property {string} extension - The file extension
 * @property {string} mimeType - The file mime type
 * @property {string} decodedString - The content of the file as string
 * @property {string} decodedBytes - The content of the file as bytes
 */
/**
 * Takes a file content as string and returns the file type, extension and decoded string and bytes.
 *
 * @param {String} fileAsString - the file content as string
 * @return {ParsedFile} returns the file type, extension and decoded string and bytes
 */
function parseFileFromString(fileAsString) {
	// logger.info("[parseFileFromString] fileAsString: " + fileAsString);
  let decodedString = null;
	// logger.info("[parseFileFromString] decodedString: " + decodedString);
  let decodedBytes = null;
  // We don't know upfront if the file is base64 encoded, so we try to decode it and if it fails
  // we use the original content.
  try {
    const byteDecoder = java.util.Base64.getDecoder();
    decodedBytes = byteDecoder.decode(fileAsString);
    const decoded = decodeBase64(fileAsString.toString());
    decodedString = new Packages.java.lang.String(decoded);
  } catch (ex) {
    // intentionally left empty
  }
  if (!decodedString || !decodedBytes) return;

	// logger.info("[parseFileFromString] post decodedString: " + decodedString);

  const type = detectFileType(decodedString);
  const mimeType = type[0];
  const extension = type[1];
	// logger.info("[parseFileFromString] mimeType: " + mimeType + "; extension: " + extension);

  if (mimeType === XML_TXT_MIME_TYPE || mimeType === XML_APP_MIME_TYPE) {
    // If the file is XML, it might contain an attachment (nonXMLBody) that we need to extract
    const cda = new XML(decodedString);
		var nonXMLBody = cda.*::component.*::nonXMLBody;
		if (nonXMLBody.length() > 0 && nonXMLBody.*::text.length() > 0) {
			return parseFileFromString(nonXMLBody.*::text.toString());
		}
  }

  return {
    mimeType: mimeType,
    extension: extension,
    decodedString: decodedString,
    decodedBytes: decodedBytes,
  };
}

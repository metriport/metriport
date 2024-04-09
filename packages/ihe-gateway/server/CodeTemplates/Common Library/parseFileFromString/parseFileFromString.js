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
 * @param {Boolean} isNonXmlBody - Whether it is a nonXmlBody, if known
 * @return {ParsedFile} returns the file type, extension and decoded string and bytes
 */
function parseFileFromString(fileAsString, isNonXmlBody) {
  if (isNonXmlBody === undefined) isNonXmlBody = false;

  let decodedBytes = null;
  let decodedString = null;
  // We don't know upfront if the file is base64 encoded, so we try to decode it and if it fails
  // we use the original content.
  try {
    const byteDecoder = java.util.Base64.getDecoder();
    decodedBytes = byteDecoder.decode(String(fileAsString).trim());
    decodedString = String(new Packages.java.lang.String(decodedBytes));
  } catch (ex) {
    logger.info("[parseFileFromString] Got a non-base64 document! ");
    decodedBytes = java.lang.String(fileAsString).trim().getBytes();
    decodedString = String(fileAsString).trim();
  }
  if (!decodedBytes) {
    logger.error("[parseFileFromString] Error decoding file content - missing decodedBytes");
    return;
  };
  if (!decodedString) {
    logger.error("[parseFileFromString] Error decoding file content - missing decodedString");
    return;
  };

  var type = detectFileType(decodedBytes, decodedString, isNonXmlBody);
  var mimeType = type[0];
  var extension = type[1];

  if (mimeType === XML_TXT_MIME_TYPE || mimeType === XML_APP_MIME_TYPE) {
    // If the file is XML, it might contain an attachment (nonXMLBody) that we need to extract
    var cda = new XML(decodedString);
		var nonXMLBody = cda.*::component.*::nonXMLBody;
		if (nonXMLBody.length() > 0 && nonXMLBody.*::text.length() > 0) {
			return parseFileFromString(nonXMLBody.*::text.toString(), true);
		}
  }

  return {
    mimeType: mimeType,
    extension: extension,
    decodedString: decodedString,
    decodedBytes: decodedBytes,
  };
}
/**
	Writes the content of the XCA ITI-39 document to a file

	@param {String} path - the file path
	@param {String} documentContents - Base64 encoded document
	@param {Object} metadata - file metadata
	@return {String} return write result or error string
*/
function xcaWriteToFile(path, documentContents, metadata) {
  var result = null;

  try {
    var bucketName = Config.getS3BucketName();
    var client = getAWSS3Client();

    // Specify file's metadata
    var meta = java.util.HashMap();
    for (var key in metadata) {
      if ("url" !== key.toString()) meta.put(key.toString(), String(metadata[key]));
    }

    var putRequest = Packages.software.amazon.awssdk.services.s3.model.PutObjectRequest.builder()
      .bucket(bucketName)
      .key(path.toString())
      .metadata(meta)
      .build();
    var requestBody = Packages.software.amazon.awssdk.core.sync.RequestBody.fromBytes(
      documentContents
    );

    result = client.putObject(putRequest, requestBody);

    return result;
  } catch (ex) {
    if (globalMap.containsKey("TEST_MODE")) logger.error("Code Template: xcaWriteToFile() - " + ex);
    throw ex;
  }
}

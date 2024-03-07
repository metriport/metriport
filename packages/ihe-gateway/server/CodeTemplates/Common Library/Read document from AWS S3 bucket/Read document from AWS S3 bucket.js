function xcaReadFromPresignedUrl(presignedUrl) {
  const urlPattern = /https:\/\/([^.]+)\.s3\.([^.]+)\.amazonaws\.com\/([^?]+)/;
  const match = presignedUrl.match(urlPattern);
  if (match) {
    const bucket = match[1];
    const filename = match[3];
    logger.info("Bucket: " + bucket + ", Filename: " + filename);
    try {
      var client = getAWSS3Client();
      var getRequest = Packages.software.amazon.awssdk.services.s3.model.GetObjectRequest.builder()
        .bucket(bucket)
        .key(filename.toString())
        .build();
        var docObject = client.getObject(getRequest);
        // Directly read all bytes from the S3 object and encode them into Base64
        var encoder = java.util.Base64.getEncoder();
        result = encoder.encodeToString(docObject.readAllBytes());
        logger.info("Document in Base64: " + result);
    } catch (ex) {
      if (globalMap.containsKey("TEST_MODE"))
        logger.error("Code Template: xcaReadFromFile() - " + ex);
    }
  } else {
    throw new Error("Invalid presigned URL format");
  }

  return result;
}

/**
	Reads the content of the XCA ITI-39 document from a file

	@param {String} path - the file path
	@return {String} return Base64 encoded document's content
*/
function xcaReadFromFile(path) {
  var result = null;

  try {
    var bucketName = Config.getS3BucketName();

    var client = getAWSS3Client();
    var getRequest = Packages.software.amazon.awssdk.services.s3.model.GetObjectRequest.builder()
      .bucket(bucketName)
      .key(path.toString())
      .build();
    var docObject = client.getObject(getRequest);
    result = new java.lang.String(docObject.readAllBytes());
  } catch (ex) {
    if (globalMap.containsKey("TEST_MODE"))
      logger.error("Code Template: xcaReadFromFile() - " + ex);
  }

  return result;
}
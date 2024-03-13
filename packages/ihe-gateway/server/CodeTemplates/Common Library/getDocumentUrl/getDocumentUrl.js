/**
	Gets url of the file on S3

	@param {String} fileName - the fileName
	@return {Boolean} return s3 location
*/
function getDocumentUrl(fileName) {
  try {
    const bucketName = Config.getS3BucketName();

    const objectRequest =
      Packages.software.amazon.awssdk.services.s3.model.GetObjectRequest.builder()
        .bucket(bucketName)
        .key(fileName.toString())
        .build();

    const presignRequest =
      Packages.software.amazon.awssdk.services.s3.presigner.model.GetObjectPresignRequest.builder()
        .signatureDuration(java.time.Duration.ofMinutes(10))
        .getObjectRequest(objectRequest)
        .build();

    const presigner = Packages.software.amazon.awssdk.services.s3.presigner.S3Presigner.create();

    const presignedRequest = presigner.presignGetObject(presignRequest);

    logger.info("Presigned URL: [{}]", presignedRequest.url().toString());
    logger.info("HTTP method: [{}]", presignedRequest.httpRequest().method());

    const url = new java.net.URL(presignedRequest.url().toString());
    const protocol = url.getProtocol();
    const host = url.getHost();
    const path = url.getPath();
    const s3Location = protocol + "://" + host + path;

    return s3Location;
  } catch (ex) {
    if (globalMap.containsKey("TEST_MODE")) logger.error("Code Template: xcaWriteToFile() - " + ex);
    throw ex;
  }
}

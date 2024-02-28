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

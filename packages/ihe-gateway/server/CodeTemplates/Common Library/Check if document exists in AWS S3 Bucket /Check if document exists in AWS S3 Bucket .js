/**
	Checks if the XCA ITI-39 document exists in s3

	@param {String} path - the file path
	@return {Boolean} return boolean
*/
function xcaDoesDocumentExist(path) {
  try {
    var bucketName = Config.getS3BucketName();

    var client = getAWSS3Client();
    var headRequest = Packages.software.amazon.awssdk.services.s3.model.HeadObjectRequest.builder()
      .bucket(bucketName)
      .key(path.toString())
      .build();
    var headObject = client.headObject(headRequest);

    return true;
  } catch (ex) {
    return false;
  }
}

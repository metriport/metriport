function xcaWriteToFile(path, documentContents, metadata) {
  var result = null;

  try {
    var bucketName = Config.getS3BucketName();
    var client = getAWSS3Client();

    // Specify file's metadata
    var meta = java.util.HashMap();
    var contentType = "application/octet-stream"; // Default content type
    for (var key in metadata) {
      if ("url" !== key.toString()) {
        meta.put(key.toString(), String(metadata[key]));
        if (key.toString() === "contentType") {
          contentType = String(metadata[key]);
        }
      }
    }

    const putRequest = Packages.software.amazon.awssdk.services.s3.model.PutObjectRequest.builder()
      .bucket(bucketName)
      .key(path.toString())
      .metadata(meta)
      .contentType(contentType)
      .build();
    const requestBody =
      Packages.software.amazon.awssdk.core.sync.RequestBody.fromBytes(documentContents);

    result = client.putObject(putRequest, requestBody);

    return result;
  } catch (ex) {
    if (globalMap.containsKey("TEST_MODE")) logger.error("Code Template: xcaWriteToFile() - " + ex);
    throw ex;
  }
}
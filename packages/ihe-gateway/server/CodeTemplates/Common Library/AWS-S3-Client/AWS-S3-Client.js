/**
 * Function to return an AWS S3 Client object.
 *
 * @return {Object} return AWS S3 Client object
 */
function getAWSS3Client() {
  try {
    const accessKey = java.lang.String(globalMap.get("ACCESS_KEY"));
    const secretKey = java.lang.String(globalMap.get("SECRET_KEY"));
    const region = Packages.software.amazon.awssdk.regions.Region.of(
      java.lang.String(globalMap.get("REGION"))
    );

    const clientBuilder = Packages.software.amazon.awssdk.services.s3.S3Client.builder();
    clientBuilder.region(region);

    var basicCredentials =
      Packages.software.amazon.awssdk.auth.credentials.AwsBasicCredentials.create(
        accessKey,
        secretKey
      );
    var staticCredentialsProvider =
      Packages.software.amazon.awssdk.auth.credentials.StaticCredentialsProvider.create(
        basicCredentials
      );
    clientBuilder.credentialsProvider(staticCredentialsProvider);

    const client = clientBuilder.build();
    return client;
  } catch (ex) {
    if (globalMap.containsKey("TEST_MODE")) logger.error("Code Template: getAWSS3Client() - " + ex);
    throw ex;
  }
}

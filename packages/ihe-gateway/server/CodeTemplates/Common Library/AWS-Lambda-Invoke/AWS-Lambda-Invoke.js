/**
 * Function to invoke an AWS Lambda function.
 *
 * @param {string} functionName The name of the Lambda function to invoke.
 * @param {Object} payload The payload to pass to the Lambda function.
 * @return {Object} return The response from the Lambda function.
 */
function invokeLambda(functionName, payload) {
  try {
    // Initialize AWS Lambda client similar to how S3 client is initialized
    const accessKey = java.lang.String(globalMap.get("ACCESS_KEY"));
    const secretKey = java.lang.String(globalMap.get("SECRET_KEY"));
    const region = Packages.software.amazon.awssdk.regions.Region.of(
      java.lang.String(globalMap.get("REGION"))
    );

    const basicCredentials =
      Packages.software.amazon.awssdk.auth.credentials.AwsBasicCredentials.create(
        accessKey,
        secretKey
      );
    const staticCredentialsProvider =
      Packages.software.amazon.awssdk.auth.credentials.StaticCredentialsProvider.create(
        basicCredentials
      );
    const lambdaClient = Packages.software.amazon.awssdk.services.lambda.LambdaClient.builder()
      .region(region)
      .credentialsProvider(staticCredentialsProvider)
      .build();

    // Prepare and invoke the Lambda function
    const requestBuilder =
      Packages.software.amazon.awssdk.services.lambda.model.InvokeRequest.builder()
        .functionName(functionName)
        .invocationType(
          Packages.software.amazon.awssdk.services.lambda.model.InvocationType.REQUEST_RESPONSE
        );
    if (payload) {
      const actualPayload = Packages.software.amazon.awssdk.core.SdkBytes.fromUtf8String(
        JSON.stringify(payload)
      );
      requestBuilder.payload(actualPayload);
      channelMap.put("Payload", "present");
    } else {
      channelMap.put("Payload", "not present");
    }
    const request = requestBuilder.build();

    const invokeResponse = lambdaClient.invoke(request);

    const responseString = invokeResponse.payload().asUtf8String();
    const responseJson = JSON.parse(responseString);
    if (responseJson.statusCode < 200 || responseJson.statusCode >= 300) {
      logger.info("FunctionError: " + invokeResponse.functionError());
      logger.info("Payload: " + JSON.stringify(payload));
      throw new Error(
        "Error invoking Lambda function: " +
          functionName
      );
    };
    
    return responseJson;
  } catch (ex) {
    if (globalMap.containsKey("TEST_MODE")) logger.error("Code Template: invokeLambda() - " + ex);
    throw ex;
  }
}

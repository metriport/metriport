/**
	Modify the description here. Modify the function name and parameters as needed. One function per
	template is recommended; create a new code template for each new function.

	@return {Object} return AWS S3 Client object
*/
function getAWSS3Client() {

	var client = null;

	try {

		var accessKey = java.lang.String(globalMap.get('ACCESS_KEY'));
		var secretKey = java.lang.String(globalMap.get('SECRET_KEY'));		
		var region = Packages.software.amazon.awssdk.regions.Region.of(java.lang.String(globalMap.get('REGION')));
		
		var clientBuilder = Packages.software.amazon.awssdk.services.s3.S3Client.builder();
		clientBuilder.region(region);		
		
		var basicCredentials = Packages.software.amazon.awssdk.auth.credentials.AwsBasicCredentials.create(accessKey, secretKey);
		var staticCredentialsProvider = Packages.software.amazon.awssdk.auth.credentials.StaticCredentialsProvider.create(basicCredentials);
		clientBuilder.credentialsProvider(staticCredentialsProvider);

		client = clientBuilder.build();
		
	} catch(ex) {
		if (globalMap.containsKey('TEST_MODE')) logger.error('Code Template: getAWSS3Client() - ' + ex);
		throw ex;
	}

	return client;	
}

function invokeLambda(functionName, payload) {
    var responseJson = null;

    try {
        // Initialize AWS Lambda client similar to how S3 client is initialized
        var accessKey = java.lang.String(globalMap.get('ACCESS_KEY'));
        var secretKey = java.lang.String(globalMap.get('SECRET_KEY'));
        var region = Packages.software.amazon.awssdk.regions.Region.US_EAST_2;

        var lambdaClientBuilder = Packages.software.amazon.awssdk.services.lambda.LambdaClient.builder();
        lambdaClientBuilder.region(region);

        var basicCredentials = Packages.software.amazon.awssdk.auth.credentials.AwsBasicCredentials.create(accessKey, secretKey);
        var staticCredentialsProvider = Packages.software.amazon.awssdk.auth.credentials.StaticCredentialsProvider.create(basicCredentials);
        lambdaClientBuilder.credentialsProvider(staticCredentialsProvider);

        var lambdaClient = lambdaClientBuilder.build();

        // Prepare and invoke the Lambda function
        var invokeRequestBuilder = Packages.software.amazon.awssdk.services.lambda.model.InvokeRequest.builder();
        invokeRequestBuilder.functionName(functionName);
        invokeRequestBuilder.invocationType(Packages.software.amazon.awssdk.services.lambda.model.InvocationType.REQUEST_RESPONSE);
        invokeRequestBuilder.payload(java.nio.ByteBuffer.wrap(JSON.stringify(payload).getBytes("UTF-8")));

        var invokeResponse = lambdaClient.invoke(invokeRequestBuilder.build());
        var responseBytes = new java.lang.String(invokeResponse.payload().array(), "UTF-8");
        responseJson = JSON.parse(responseBytes);

    } catch (ex) {
        if (globalMap.containsKey('TEST_MODE')) logger.error('Code Template: invokeLambda() - ' + ex);
        throw ex;
    }

    return responseJson;
}

function invokeLambdaDirectly(functionName, payload) {
    var region = Packages.software.amazon.awssdk.regions.Region.US_EAST_2;
    var uri = "https://lambda.us-east-2.amazonaws.com/2015-03-31/functions/" + functionName + "/invocations";

    // Retrieve AWS credentials
    var credentialsProvider = Packages.software.amazon.awssdk.auth.credentials.DefaultCredentialsProvider.create();

    // Create the unsigned request
    var unsignedRequestBuilder = Packages.software.amazon.awssdk.http.SdkHttpFullRequest.builder()
        .method(Packages.software.amazon.awssdk.http.SdkHttpMethod.POST)
        .uri(Packages.java.net.URI.create(uri))
        .putHeader("Content-Type", "application/json");

    // Since we're avoiding contentStreamProvider, we'll not set the body here
    var unsignedRequest = unsignedRequestBuilder.build();

    // Sign the request
    var signer = Packages.software.amazon.awssdk.auth.signer.Aws4Signer.create();
    var signerParams = Packages.software.amazon.awssdk.auth.signer.params.Aws4SignerParams.builder()
        .awsCredentials(credentialsProvider.resolveCredentials())
        .signingName("lambda")
        .signingRegion(region)
        .build();
    var signedRequest = signer.sign(unsignedRequest, signerParams);

    // Convert the signed request to Java's HttpRequest, setting the payload directly here
    var requestBuilder = Packages.java.net.http.HttpRequest.newBuilder()
        .uri(Packages.java.net.URI.create(uri))
        .POST(Packages.java.net.http.HttpRequest.BodyPublishers.ofString(payload));

    // Add the signed headers to the request
    signedRequest.headers().forEach(function(values, header) {
        values.forEach(function(value) {
            requestBuilder.header(header, value);
        });
    });

    var javaHttpRequest = requestBuilder.build();

    // Send the request using Java's HttpClient
    var client = Packages.java.net.http.HttpClient.newHttpClient();
    var response = client.send(javaHttpRequest, Packages.java.net.http.HttpResponse.BodyHandlers.ofString());

    // Process the response
    var statusCode = response.statusCode();
    var responseBody = response.body();

    logger.info("Status Code: " + statusCode);
    logger.info("Response: " + responseBody);

    return responseBody;
}
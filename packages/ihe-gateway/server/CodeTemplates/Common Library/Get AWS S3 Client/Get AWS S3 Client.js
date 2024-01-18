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

		var region = Packages.software.amazon.awssdk.regions.Region.US_EAST_2;
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
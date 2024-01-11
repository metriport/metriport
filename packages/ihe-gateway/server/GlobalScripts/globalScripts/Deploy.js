// This script executes once for each deploy or redeploy task
// You only have access to the globalMap here to persist data

// In test mode, channels log all exception errors
if (configurationMap.containsKey('TEST_MODE') && 'true' == configurationMap.get('TEST_MODE')) {
	globalMap.put('TEST_MODE', true);
}


// AWS S3 credentials
var accessKey = java.lang.String(Packages.java.lang.System.getenv("AWS_ACCESS_KEY_ID"));
var secretKey = java.lang.String(Packages.java.lang.System.getenv("AWS_SECRET_ACCESS_KEY"));

if (accessKey.length() > 0 && secretKey.length() > 0) {	
	globalMap.put('ACCESS_KEY', accessKey);
	globalMap.put('SECRET_KEY', secretKey);	
} else {
	logger.error('The AWS S3 credentials variables were not found; the XCA ITI-39 Processor channels will not work');
}


   
return;



















var payload = channelMap.get('REQUEST');
var test_client = getAWSS3Client();
var response = invokeLambda("IHEInboundPatientDiscoveryLambda", payload);
logger.info("Response: " + response);
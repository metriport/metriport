// This script executes once for each deploy or redeploy task
// You only have access to the globalMap here to persist data

// In test mode, channels log all exception errors
if (configurationMap.containsKey("TEST_MODE") && "true" == configurationMap.get("TEST_MODE")) {
  globalMap.put("TEST_MODE", true);
}

// AWS S3 credentials
const accessKey = Packages.java.lang.System.getenv("AWS_ACCESS_KEY_ID");
const secretKey = Packages.java.lang.System.getenv("AWS_SECRET_ACCESS_KEY");
const region = Packages.java.lang.System.getenv("AWS_REGION");

if (accessKey && accessKey.length() > 0 && secretKey && secretKey.length() > 0) {
  globalMap.put("ACCESS_KEY", accessKey);
  globalMap.put("SECRET_KEY", secretKey);
  globalMap.put("REGION", region);
}

const apiBaseAddress = Config.getApiBaseAddress();
if (apiBaseAddress) {
  globalMap.put("API_BASE_ADDRESS", apiBaseAddress);
}

// https://docs.oracle.com/javase/1.5.0/docs/api/java/lang/Runtime.html
logger.info("Free memory:  " + java.lang.Runtime.getRuntime().freeMemory());
logger.info("Total memory: " + java.lang.Runtime.getRuntime().totalMemory());
logger.info("Max memory:   " + java.lang.Runtime.getRuntime().maxMemory());

return;

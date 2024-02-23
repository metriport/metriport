// This script executes once for each deploy or redeploy task
// You only have access to the globalMap here to persist data

// In test mode, channels log all exception errors
if (configurationMap.containsKey("TEST_MODE") && "true" == configurationMap.get("TEST_MODE")) {
  globalMap.put("TEST_MODE", true);
}

// AWS S3 credentials
const accessKey = Packages.java.lang.System.getenv("AWS_ACCESS_KEY_ID");
const secretKey = Packages.java.lang.System.getenv("AWS_SECRET_ACCESS_KEY");

if (accessKey && accessKey.length() > 0 && secretKey && secretKey.length() > 0) {
  globalMap.put("ACCESS_KEY", accessKey);
  globalMap.put("SECRET_KEY", secretKey);
}

return;

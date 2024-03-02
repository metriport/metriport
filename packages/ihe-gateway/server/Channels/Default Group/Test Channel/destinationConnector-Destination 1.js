var payload = channelMap.get("REQUEST");

logger.info("Channel running...");
try {
  const response = invokeLambda("TesterLambda", payload);
  logger.info("Response: " + response);

  channelMap.put("RESPONSE", response);
  return JSON.stringify( { response: response });
} catch (ex) {
  if (globalMap.containsKey("TEST_MODE")) logger.error("Inbound XCPD Dest Connector - " + ex);
  channelMap.put("RESPONSE_ERROR", ex.toString());
  throw ex;
}

const payload = channelMap.get("REQUEST");

try {
  const response = invokeLambda("IHEInboundPatientDiscoveryLambda", payload);
  // logger.info("Response: " + response);
  channelMap.put("RESPONSE", response);
} catch (ex) {
  if (globalMap.containsKey("TEST_MODE")) logger.error("Inbound XCPD Dest Connector - " + ex);
  channelMap.put("RESPONSE_ERROR", ex.toString());
  throw ex;
}

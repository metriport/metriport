logger.info("destinationConnector-AWS Lambda Interface.js");
const payload = channelMap.get("REQUEST");
try {
  // TODO make the lambda name dynamic
  const response = invokeLambda("IHEInboundDocumentRetrievalLambda", payload);
  channelMap.put("LAMBDA_RESPONSE", response);
  msg = response.body;
  return JSON.stringify(msg);
} catch (ex) {
  if (globalMap.containsKey("TEST_MODE")) logger.error("Inbound XCPD Dest Connector - " + ex);
  channelMap.put("RESPONSE_ERROR", ex.toString());
  throw ex;
}
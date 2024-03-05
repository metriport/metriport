const payload = channelMap.get("REQUEST");
try {
  // TODO make the lambda name dynamic
  // TODO make the lambda name dynamic
  // TODO make the lambda name dynamic
  const response = invokeLambda("IHEInboundDocumentQueryLambda", payload);
  channelMap.put("LAMBDA_RESPONSE", response);
  msg = response.body;
  // Sets the response to `msg` and the status to `sent` on the message view on Admin.
  // See: https://docs.nextgen.com/bundle/Mirth_User_Guide_4_4_0/page/connect/connect/topics/c_JavaScript_Writer_Return_Values_connect_ug.html
  return JSON.stringify(msg);
} catch (ex) {
  if (globalMap.containsKey("TEST_MODE")) logger.error("Inbound XCA DQ Dest Connector - " + ex);
  channelMap.put("RESPONSE_ERROR", ex.toString());
  throw ex;
}

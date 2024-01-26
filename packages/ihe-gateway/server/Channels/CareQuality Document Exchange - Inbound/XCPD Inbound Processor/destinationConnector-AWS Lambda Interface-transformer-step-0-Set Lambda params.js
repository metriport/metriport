// Set the parameters required for the AWS Lambda
var inboundXCPDUrl = Config.getInboundXcpdUrl();

if (inboundXCPDUrl) {
  channelMap.put("inboundXCPDUrl", inboundXCPDUrl);
} else {
  logger.error("INBOUND_XCPD_URL environment variable is not set");
}

channelMap.put("DEST_ID", "d" + connectorMessage.getDestinationIdMap().get("AWS Lambda Interface"));

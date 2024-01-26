// Set the parameters required for the AWS Lambda
var inboundDRUrl = Config.getInboundDrUrl();

if (inboundDRUrl) {
  channelMap.put("URL", inboundDRUrl);
} else {
  logger.error("INBOUND_XCA39_URL environment variable is not set");
}

channelMap.put("DEST_ID", "d" + connectorMessage.getDestinationIdMap().get("AWS Lambda Interface"));

// Message ID required for Attachment
channelMap.put("XCAMESSAGEID", java.lang.Long(connectorMessage.getMessageId()));

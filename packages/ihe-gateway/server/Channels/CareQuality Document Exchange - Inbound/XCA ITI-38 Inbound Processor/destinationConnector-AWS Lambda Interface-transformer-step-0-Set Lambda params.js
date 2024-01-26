// Set the parameters required for the AWS Lambda
var inboundDQUrl = Config.getInboundDqUrl();

if (inboundDQUrl) {
  channelMap.put("URL", inboundDQUrl);
} else {
  logger.error("INBOUND_XCA38_URL environment variable is not set");
}

channelMap.put("DEST_ID", "d" + connectorMessage.getDestinationIdMap().get("AWS Lambda Interface"));

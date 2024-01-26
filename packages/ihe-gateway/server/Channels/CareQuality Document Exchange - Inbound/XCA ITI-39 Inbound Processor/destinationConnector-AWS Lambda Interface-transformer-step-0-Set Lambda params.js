// Set the parameters required for the AWS Lambda
var inboundDRUrl = Config.getInboundDrUrl();

channelMap.put("URL", inboundDRUrl);
channelMap.put("DEST_ID", "d" + connectorMessage.getDestinationIdMap().get("AWS Lambda Interface"));

// Message ID required for Attachment
channelMap.put("XCAMESSAGEID", java.lang.Long(connectorMessage.getMessageId()));

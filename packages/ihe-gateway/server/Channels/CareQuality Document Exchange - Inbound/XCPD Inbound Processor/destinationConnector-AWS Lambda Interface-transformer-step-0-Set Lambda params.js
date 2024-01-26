// Set the parameters required for the AWS Lambda
var inboundXCPDUrl = Config.getInboundXcpdUrl();

channelMap.put("URL", inboundXCPDUrl);
channelMap.put("DEST_ID", "d" + connectorMessage.getDestinationIdMap().get("AWS Lambda Interface"));

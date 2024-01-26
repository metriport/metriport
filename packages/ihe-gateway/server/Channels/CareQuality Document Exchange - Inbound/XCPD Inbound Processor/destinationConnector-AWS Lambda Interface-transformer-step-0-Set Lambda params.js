// Set the parameters required for the AWS Lambda
var inboundXCPDUrl = Config.getInboundXcpdUrl();

channelMap.put("inboundXCPDUrl", inboundXCPDUrl);
channelMap.put("DEST_ID", "d" + connectorMessage.getDestinationIdMap().get("AWS Lambda Interface"));

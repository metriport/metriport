// Set the parameters required for the AWS Lambda
var inboundDQUrl = Config.getInboundDqUrl();

channelMap.put("URL", inboundDQUrl);
channelMap.put("DEST_ID", "d" + connectorMessage.getDestinationIdMap().get("AWS Lambda Interface"));

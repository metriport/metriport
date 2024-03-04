// Set the parameters required for the AWS Lambda
// TODO Update this to use lambda name
// TODO Update this to use lambda name
// TODO Update this to use lambda name
channelMap.put("URL", Config.getInboundPatientDiscoveryURL());
channelMap.put("DEST_ID", "d" + connectorMessage.getDestinationIdMap().get("AWS Lambda Interface"));
// Set the parameters required for the AWS Lambda
channelMap.put("URL", Config.getInboundPatientDiscoveryURL());
channelMap.put("DEST_ID", "d" + connectorMessage.getDestinationIdMap().get("AWS Lambda Interface"));
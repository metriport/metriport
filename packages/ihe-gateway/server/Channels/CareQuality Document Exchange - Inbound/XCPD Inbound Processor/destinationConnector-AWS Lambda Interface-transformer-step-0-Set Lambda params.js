// Set the parameters required for the AWS Lambda
logger.info("2");
channelMap.put("URL", Config.getInboundPatientDiscoveryURL());
channelMap.put("DEST_ID", "d" + connectorMessage.getDestinationIdMap().get("AWS Lambda Interface"));
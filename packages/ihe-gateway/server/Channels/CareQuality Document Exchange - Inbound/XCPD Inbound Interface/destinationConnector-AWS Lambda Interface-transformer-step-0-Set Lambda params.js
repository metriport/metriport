// Set the parameters required for the AWS Lambda

logger.info("destinationConnector-AWS Lambda Interface-transformer-step-0-Set Lambda params.js");

channelMap.put("URL", Config.getInboundPatientDiscoveryURL());
channelMap.put("DEST_ID", "d" + connectorMessage.getDestinationIdMap().get("AWS Lambda Interface"));
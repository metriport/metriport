logger.info("destinationConnector-AWS Lambda Interface-transformer-step-0-Set Lambda params.js");
// Set the parameters required for the AWS Lambda
channelMap.put("URL", Config.getInboundDocumentQueryURL());
channelMap.put("DEST_ID", "d" + connectorMessage.getDestinationIdMap().get("AWS Lambda Interface"));

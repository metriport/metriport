// Set the parameters required for the AWS Lambda
channelMap.put('URL', configurationMap.get('INBOUND.XCPD55'));

channelMap.put('DEST_ID', 'd' + connectorMessage.getDestinationIdMap().get('AWS Lambda Interface'));
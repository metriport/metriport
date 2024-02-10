// Set the parameters required for the AWS Lambda
channelMap.put('URL', configurationMap.get('INBOUND_PATIENT_DISCOVERY_URL'));

channelMap.put('DEST_ID', 'd' + connectorMessage.getDestinationIdMap().get('AWS Lambda Interface'));
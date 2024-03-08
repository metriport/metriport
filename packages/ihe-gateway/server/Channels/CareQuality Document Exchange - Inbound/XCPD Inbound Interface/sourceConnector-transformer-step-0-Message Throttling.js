// Enforcing limits on incoming requests
if (configurationMap.containsKey('INBOUND.QUEUE.SIZE')) try {
	
	const maxSize = parseInt(configurationMap.get('INBOUND.QUEUE.SIZE'));
	var queueSize = ChannelUtil.getQueuedCount(channelId);

	if (queueSize > maxSize) {
		var soapFault = getSOAPFault('Too much activity');
		if (soapFault) {
			
			var soap = soapFault.namespace('soap');
			var wsa = soapFault.namespace('wsa');
			soapFault.soap::Header.wsa::Action = 'urn:hl7-org:v3:PRPA_IN201306UV02:CrossGatewayPatientDiscovery';
			soapFault.soap::Header.wsa::RelatesTo = msg.*::Header.*::MessageID.toString();
	
			responseMap.put('RESPONSE', soapFault.toString());
			logger.error('XCPD Inbound Interface: Message Throttling - Too much activity');
		}
		destinationSet.removeAll();
		return;
	}

} catch(ex) {
	if (globalMap.containsKey('TEST_MODE')) logger.error('XCPD Inbound Interface: Message Throttling - ' + ex);
	throw ex;
}
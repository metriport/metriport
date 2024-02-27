// Deferred mode - urn:hl7-org:v3:PRPA_IN201305UV02:Deferred:CrossGatewayPatientDiscovery

try {
	
	var mode = msg.*::Header.*::Action.toString();
	if (mode.indexOf(':Deferred:') > 0) {
		var soapFault = getSOAPFault('The responding gateway does not support deferred mode');
		if (soapFault) {
			
			var soap = soapFault.namespace('soap');
			var wsa = soapFault.namespace('wsa');
			soapFault.soap::Header.wsa::Action = 'urn:hl7-org:v3:PRPA_IN201306UV02:CrossGatewayPatientDiscovery';
			soapFault.soap::Header.wsa::RelatesTo = msg.*::Header.*::MessageID.toString();

			responseMap.put('XCPD_RESPONSE', soapFault.toString());
		}
		destinationSet.removeAll();
		return;
	}

} catch(ex) {
	if (globalMap.containsKey('TEST_MODE')) logger.error('XCPD Inbound Interface: Processing Mode Validation - ' + ex);
	throw ex;
}
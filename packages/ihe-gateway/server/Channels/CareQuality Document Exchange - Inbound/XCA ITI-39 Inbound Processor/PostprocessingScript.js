// This script executes once after a message has been processed
// Responses returned from here will be stored as "Postprocessor" in the response map

var dest = responseMap.get(channelMap.get('DEST_ID'));

if (dest && 'ERROR' == dest.getStatus()) try {

	var operationOutcome = {"resourceType": "OperationOutcome",
						"issue": [
							{"severity": "error", "code": "XDSRegistryError", "details": {"text": "Internal error" } }
						]
					};

	var payload = channelMap.get('QUERYREQUEST');

	// Generate CrossGatewayQueryResponse
	var _reponse = getXCAITI39QueryResponse(payload, operationOutcome);
	if (_reponse) {

		// Generate SOAP Envelope
		var soapTemplate = getSOAPTemplate();
		var soap = soapTemplate.namespace('soap');
		var wsa = soapTemplate.namespace('wsa');
		soapTemplate.soap::Header.wsa::Action = 'urn:ihe:iti:2007:CrossGatewayRetrieveResponse';
		soapTemplate.soap::Header.wsa::RelatesTo = 'urn:uuid:' + channelMap.get('MSG_ID');
		soapTemplate.*::Body.appendChild(_reponse);
		
		responseMap.put('RESPONSE', soapTemplate.toString());
	}

} catch(ex) {
	if (globalMap.containsKey('TEST_MODE')) logger.error('XCA ITI-39 Inbound Processor: Postprocessor - ' + ex);
}


return;
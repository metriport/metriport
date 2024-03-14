// Queries other than FindDocuments are not currently supported
if ('urn:uuid:14d4debf-8f97-4251-9a74-a90016b0af0d' !== msg.*::Body.*::AdhocQueryRequest.*::AdhocQuery.@id.toString()) {

	var operationOutcome = {"resourceType": "OperationOutcome",
						"issue": [
							{"severity": "error", "code": "XDSRegistryError", "details": {"text": "IHE ITI-38 queries other than FindDocuments are not currently supported" } }
						]
					};

	// Generate CrossGatewayQueryResponse
	var _reponse = getXCAITI38QueryResponse(null, operationOutcome);
	if (_reponse) {

		// Generate SOAP Envelope
		var soapTemplate = getSOAPTemplate();
		var soap = soapTemplate.namespace('soap');
		var wsa = soapTemplate.namespace('wsa');
		soapTemplate.soap::Header.wsa::Action = msg.*::Header.*::Action.toString() + 'Response';
		soapTemplate.soap::Header.wsa::RelatesTo = 'urn:uuid:' + channelMap.get('MSG_ID');
		soapTemplate.*::Body.appendChild(_reponse);
		
		responseMap.put('RESPONSE', soapTemplate.toString());
	}

	destinationSet.removeAll();
	return;	
}
logger.info('sourceConnector-transformer-step-3-Validate request.js');
// Validate if any document is requested
if (0 == msg.*::Body.*::RetrieveDocumentSetRequest.*::DocumentRequest.length()) {

	var operationOutcome = {"resourceType": "OperationOutcome",
						"issue": [
							{"severity": "error", "code": "XDSRegistryError", "details": {"text": "The IHE ITI-39 query does not include any document requests; there is nothing to process" } }
						]
					};

	var payload = channelMap.get('QUERYREQUEST');

	// Generate CrossGatewayQueryResponse
	var _reponse = getXCAITI39QueryResponse(null, operationOutcome, false);
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
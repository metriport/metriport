// Generate SOAP Envelope
var soapTemplate = getSOAPTemplate();
var soap = soapTemplate.namespace('soap');
var wsa = soapTemplate.namespace('wsa');
soapTemplate.soap::Header.wsa::Action = 'urn:ihe:iti:2007:CrossGatewayRetrieveResponse';
soapTemplate.soap::Header.wsa::RelatesTo = 'urn:uuid:' + channelMap.get('MSG_ID');

//var payload = channelMap.get('QUERYREQUEST');
channelMap.put('STATUS', 'Success');

var operationOutcome = null, failure = false;
if (msg.hasOwnProperty('operationOutcome')) {
	operationOutcome = msg.operationOutcome;
	failure = operationOutcome.issue.some(item => ['fatal', 'error'].includes(item.severity));
	if (failure) channelMap.put('STATUS', 'Failure');
}
if (!channelMap.containsKey('MTOM')) {
	logger.info('XCA ITI-39 Inbound Interface: ITI-39 response processing - simple SOAP response');
	// Generate RetrieveDocumentSetResponse	
	try {	
		var _reponse = (failure) ? getXCAITI39QueryResponse(null, operationOutcome) : getXCAITI39QueryResponse(msg, operationOutcome, channelMap.containsKey('MTOM'));
		if (_reponse) {
			soapTemplate.*::Body.appendChild(_reponse);
			responseMap.put('RESPONSE', soapTemplate.toString());
		}

	} catch(ex) {
		if (globalMap.containsKey('TEST_MODE')) logger.error('XCA ITI-39 Inbound Interface: ' + ex);
		throw ex;
	}

	// processing script
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
		if (globalMap.containsKey('TEST_MODE')) logger.error('XCA ITI-39 Inbound Interface: step-0 - ' + ex);
		throw ex;
	}
	return
}
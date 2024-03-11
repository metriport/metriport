// Store the HTTP code only

// old post processing script from processor
var dest = responseMap.get(channelMap.get('DEST_ID'));
if (dest && 'ERROR' == dest.getStatus()) try {

	var operationOutcome = {"resourceType": "OperationOutcome",
						"issue": [
							{"severity": "error", "code": "XDSRegistryError", "details": {"text": "Internal error" } }
						]
					};

	var payload = channelMap.get('QUERYREQUEST');

	// Generate CrossGatewayQueryResponse
	var _reponse = getXCAITI38QueryResponse(payload, operationOutcome);
	if (_reponse) {

		// Generate SOAP Envelope
		var soapTemplate = getSOAPTemplate();
		var soap = soapTemplate.namespace('soap');
		var wsa = soapTemplate.namespace('wsa');
		soapTemplate.soap::Header.wsa::Action = 'urn:ihe:iti:2007:CrossGatewayQueryResponse';
		soapTemplate.soap::Header.wsa::RelatesTo = 'urn:uuid:' + channelMap.get('MSG_ID');
		soapTemplate.*::Body.appendChild(_reponse);
		
		responseMap.put('RESPONSE', soapTemplate.toString());
	}

} catch(ex) {
	if (globalMap.containsKey('TEST_MODE')) logger.error('XCA ITI-38 Inbound Interface: Step-0 - ' + ex);
	throw ex;
}


var http = $('responseStatusLine');
http = String(http).replace('HTTP/1.1 ', '').replace(/\D/g, '');
channelMap.put('HTTP', http.toString());

// Generate SOAP Envelope
var soapTemplate = getSOAPTemplate();
var soap = soapTemplate.namespace('soap');
var wsa = soapTemplate.namespace('wsa');
soapTemplate.soap::Header.wsa::Action = 'urn:ihe:iti:2007:CrossGatewayQueryResponse';
soapTemplate.soap::Header.wsa::RelatesTo = 'urn:uuid:' + channelMap.get('MSG_ID');

var payload = channelMap.get('QUERYREQUEST');
channelMap.put('STATUS', 'Success');

var operationOutcome = null, failure = false;
if (msg.hasOwnProperty('operationOutcome')) {
	operationOutcome = msg.operationOutcome;
	failure = operationOutcome.issue.some(item => ['fatal', 'error'].includes(item.severity));
	if (failure) channelMap.put('STATUS', 'Failure');
}

// Generate CrossGatewayQueryResponse
// May contain one or more RegistryError elements
try {
	var _reponse = getXCAITI38QueryResponse((failure) ? null : msg, operationOutcome);
	if (_reponse) {
		soapTemplate.*::Body.appendChild(_reponse);
		responseMap.put('RESPONSE', soapTemplate.toString());
	}
} catch(ex) {
	if (globalMap.containsKey('TEST_MODE')) logger.error('XCA ITI-38 Inbound Interface: Response - ' + ex);
	throw ex;
}


logger.info("destinationConnector-AWS Lambda Interface-responseTransformer-step-0-Process response.js");
// Store the HTTP code only
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
	if (globalMap.containsKey('TEST_MODE')) logger.error('XCA ITI-38 Inbound Processor: Response - ' + ex);
	throw ex;
}
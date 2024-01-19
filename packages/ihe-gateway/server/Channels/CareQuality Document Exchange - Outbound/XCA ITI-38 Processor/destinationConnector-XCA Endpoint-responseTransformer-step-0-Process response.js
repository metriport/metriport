// Store the HTTP code only
var http = $('responseStatusLine');
http = String(http).replace('HTTP/1.1 ', '').replace(/\D/g, '');
channelMap.put('HTTP', http.toString());

// Decode and parse XCA ITI-38 (Cross Gateway Query Response) message
var xml = null;

var 	queryResponseCode = '',
	homeCommunityId = null,
	soapFaultCode = null,
	soapReason = null;

try {

	//var soap = String(getBase64Body(msg));
	var soap = msg.toString();

	// Store for testing
	channelMap.put('RESPONSE', soap.toString());

	xml = new XML(soap.toString());

	// SOAP level error
	if (soap.indexOf('Fault') > 0) {
		
		// Case 3: The Initiating Gateway shall accept a SOAP fault representing a transmission error
		soapFaultCode = xml.*::Body.*::Fault.*::Code.*::Value.toString();
		soapReason = xml.*::Body.*::Fault.*::Reason.*::Text.toString();
		if (soapReason) soapReason = xml.*::Reason.*::Text.toString();
		channelMap.put('QACK', 'SOAP_FAULT');
		channelMap.put('RESULT', soapReason);

		// Generate response to be sent to the app
		var operationOutcome = getOperationOutcome(channelMap.get('MSG_ID'));
		var issue = {
					 "severity": "fatal",
					 "code": "structure",
					 "details": {"text": ""}
				};
		issue.details.text = soapReason.toString();
		operationOutcome.issue.push(issue);

		var _response = getXCA38ResponseTemplate(channelMap.get('REQUEST'), operationOutcome);
		
		// Send the response back to the app
		var result = router.routeMessageByChannelId(globalMap.get('XCAAPPINTERFACE'), JSON.stringify(_response));

		// Stop further processing
		return;
		
	} else {

		xml = xml.*::Body.*::AdhocQueryResponse;

		// The status attribute reflects the status of the operation and shall be one of the following values:
		// urn:oasis:names:tc:ebxml-regrep:ResponseStatusType:Success
		// urn:oasis:names:tc:ebxml-regrep:ResponseStatusType:Failure
		// urn:ihe:iti:2007:ResponseStatusType:PartialSuccess
		queryResponseCode = xml.@status.toString().split(':').pop();
		
		channelMap.put('QACK', queryResponseCode.toString());
	}
	
} catch(ex) {
	if (globalMap.containsKey('TEST_MODE')) logger.error('XCA ITI-39 Processor: Response - ' + ex);
	channelMap.put('RESPONSE_ERROR', ex.toString());
}
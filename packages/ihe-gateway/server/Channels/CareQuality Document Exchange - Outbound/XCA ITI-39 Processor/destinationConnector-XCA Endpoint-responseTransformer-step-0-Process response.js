// Store the HTTP code only
var http = $('responseStatusLine');
http = String(http).replace('HTTP/1.1 ', '').replace(/\D/g, '');
channelMap.put('HTTP', http.toString());
channelMap.put('RESPONSE_TIME', getCurrentDate());

// Decode and parse XCA ITI-38 (Cross Gateway Query Response) message
var xml = null;

var 	queryResponseCode = '',
	homeCommunityId = null,
	soapFaultCode = null,
	soapReason = null;

try {
	xml = msg.*::Body.*::RetrieveDocumentSetResponse;

	// The status attribute reflects the status of the operation and shall be one of the following values:
	// urn:oasis:names:tc:ebxml-regrep:ResponseStatusType:Success
	// urn:ihe:iti:2007:ResponseStatusType:PartialSuccess
	// urn:oasis:names:tc:ebxml-regrep:ResponseStatusType:Failure
	queryResponseCode = xml.*::RegistryResponse.@status.toString().split(':').pop();		
	channelMap.put('QACK', queryResponseCode.toString());

	
} catch(ex) {
	if (globalMap.containsKey('TEST_MODE')) logger.error('XCA ITI-39 Processor: Response - ' + ex);
	channelMap.put('RESPONSE_ERROR', ex.toString());
	throw ex;
}
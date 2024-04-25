// Decode and parse XCA ITI-38 (Cross Gateway Query Response) message
var xml = null;

var 	queryResponseCode = '',
	homeCommunityId = null,
	soapFaultCode = null,
	soapReason = null;

try {
  xml = msg.*::Body.*::AdhocQueryResponse;

	// The status attribute reflects the status of the operation and shall be one of the following values:
	// urn:oasis:names:tc:ebxml-regrep:ResponseStatusType:Success
	// urn:oasis:names:tc:ebxml-regrep:ResponseStatusType:Failure
	// urn:ihe:iti:2007:ResponseStatusType:PartialSuccess
	queryResponseCode = xml.@status.toString().split(':').pop();
	
	channelMap.put('QACK', queryResponseCode.toString());
	
	
} catch(ex) {
	if (globalMap.containsKey('TEST_MODE')) logger.error('XCA ITI-39 Processor: Response - ' + ex);
	channelMap.put('RESPONSE_ERROR', ex.toString());
	throw ex;
}
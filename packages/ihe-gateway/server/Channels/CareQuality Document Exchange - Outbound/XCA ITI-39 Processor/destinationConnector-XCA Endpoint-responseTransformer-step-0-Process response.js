// Store the HTTP code only
var http = $('responseStatusLine');
http = String(http).replace('HTTP/1.1 ', '').replace(/\D/g, '');
channelMap.put('HTTP', http.toString());

var requestId = channelMap.get('MSG_ID');
var cxId = channelMap.get('CUSTOMER_ID');

var baseLogMessage = "XCA ITI39 Processor: Response (Case0) - requestId: " + requestId.toString() + ", " + "cxId: " + cxId.toString() + " - ";


// Decode and parse XCA ITI-38 (Cross Gateway Query Response) message
var xml = null;

var 	queryResponseCode = '',
	homeCommunityId = null,
	soapFaultCode = null,
	soapReason = null;

try {

	var soap = msg.toString();

	// Store for testing
	channelMap.put('RESPONSE', soap.toString());

  logger.info(baseLogMessage + 'Response: ' + soap);

	xml = new XML(soap.toString());

	// SOAP level error
	if (soap.indexOf('Fault') > 0) {

		channelMap.put('QACK', 'SOAP_FAULT');
		// Stop further processing
		return;

	} else {

		xml = xml.*::Body.*::RetrieveDocumentSetResponse;

		// The status attribute reflects the status of the operation and shall be one of the following values:
		// urn:oasis:names:tc:ebxml-regrep:ResponseStatusType:Success
		// urn:ihe:iti:2007:ResponseStatusType:PartialSuccess
		// urn:oasis:names:tc:ebxml-regrep:ResponseStatusType:Failure
		queryResponseCode = xml.*::RegistryResponse.@status.toString().split(':').pop();
		channelMap.put('QACK', queryResponseCode.toString());
	}

} catch(ex) {
  logger.error(baseLogMessage + 'Error: ' + ex)
  channelMap.put('RESPONSE_ERROR', ex.toString());
	throw ex;
}
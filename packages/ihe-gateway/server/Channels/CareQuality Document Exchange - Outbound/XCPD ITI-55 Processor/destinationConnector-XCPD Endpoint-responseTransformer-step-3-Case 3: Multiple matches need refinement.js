// Case 3: The Responding Gateway finds more than one patient close to matching the criteria sent in the query parameters but no matches 
// close enough for the necessary assurance level and more attributes might allow the Responding Gateway to return a match.
// AA (application accept) is returned in Acknowledgement.typeCode (transmission wrapper).
// OK (data found, no errors) is returned in QueryAck.queryResponseCode (control act wrapper)
// No RegistrationEvent is returned in the response, but the Responding Gateway provides a suggestion in terms of demographics that may help identify a match.

if ('AA' == ack.toString() && 'OK' == queryResponseCode.toString()) try {

	// NHIN: The response to IHE XCPD Cross Gateway Patient Discovery Transaction [ITI-55] may contain multiple entries, 
	// but only a single entry per assigning authority is allowed.
	// The choice of allowing one or zero entries per assigning authority is a compromise between false negatives and false positives.
	// Requiring only a single entry per assigning authority may force a responding community to return zero matches because no single choice is appropriate, 
	// thus increasing the likelihood of false negatives.

	// NHIN: If a responding gateway determines that additional attributes may help to achieve a match, it may respond with a specialized set of error codes.

	// Stop further processing
	responseStatus = ERROR;
	return;
} catch(ex) {
	if (globalMap.containsKey('TEST_MODE')) logger.error('XCPD ITI-55 Processor: Response (Case3) - ' + ex);
	channelMap.put('RESPONSE_ERROR', ex.toString());
	throw ex;	
}
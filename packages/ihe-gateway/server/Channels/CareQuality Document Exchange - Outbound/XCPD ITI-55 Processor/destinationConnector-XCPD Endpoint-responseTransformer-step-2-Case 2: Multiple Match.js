// Case 2: The Responding Gateway finds more than one patient close to matching the criteria sent in the query parameters and the policy allows returning multiple.
// AA (application accept) is returned in Acknowledgement.typeCode (transmission wrapper).
// OK (data found, no errors) is returned in QueryAck.queryResponseCode (control act wrapper)
// One RegistrationEvent (and the associated Patient role, subject of that event) is returned for each patient record found.

var requestId = channelMap.get('MSG_ID');
var cxId = channelMap.get('CUSTOMER_ID');

var baseLogMessage = "XCPD ITI55 Processor: Response (Case2) - requestId: " + requestId.toString() + ", " + "cxId: " + cxId.toString() + " - ";

if ('AA' == ack.toString() && 'OK' == queryResponseCode.toString()) try {

	// NHIN: The response to IHE XCPD Cross Gateway Patient Discovery Transaction [ITI-55] may contain multiple entries, 
	// but only a single entry per assigning authority is allowed.
	// The choice of allowing one or zero entries per assigning authority is a compromise between false negatives and false positives.
	// Requiring only a single entry per assigning authority may force a responding community to return zero matches because no single choice is appropriate, 
	// thus increasing the likelihood of false negatives.

  logger.info(baseLogMessage + "Multiple matches found");
	
	// Stop further processing
	responseStatus = ERROR;
	return;
} catch(ex) {
  logger.error(baseLogMessage + 'Error: ' + ex);
	channelMap.put('RESPONSE_ERROR', ex.toString());	
	throw ex;
}
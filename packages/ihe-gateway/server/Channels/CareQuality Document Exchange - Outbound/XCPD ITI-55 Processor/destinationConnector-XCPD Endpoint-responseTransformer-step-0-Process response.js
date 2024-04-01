// Store the HTTP code only
var http = $('responseStatusLine');
http = String(http).replace('HTTP/1.1 ', '').replace(/\D/g, '');
channelMap.put('HTTP', http.toString());

// https://docs.nextgen.com/bundle/Mirth_User_Guide_4_4_2/page/connect/connect/topics/c_Common_Scenarios_connect_ug.html
//if (responseStatus == QUEUED && connectorMessage.getSendAttempts() >= 2) {
//	responseStatus = ERROR;
//	responseStatusMessage = 'Maximum send attempts exceeded.';
//}

// Decode and parse XCPD ITI-55 (Cross Gateway Patient Discovery Response) message
var xml = null;

var 	ack = '', 
	queryResponseCode = '',
	homeCommunityId = null,
	soapFaultCode = null,
	soapReason = null;

try {

	var soap = msg.toString();

<<<<<<< Updated upstream
	// Store for testing
	channelMap.put('RESPONSE', soap.toString());

	xml = new XML(soap.toString());

	// SOAP level error
	if (soap.indexOf('Fault') > 0) {
=======
	xml = new XML(soap);
	xml = xml.*::Body.*::PRPA_IN201306UV02;
>>>>>>> Stashed changes

	// Acknowledgement code as described in HL7 message processing rules
	// AA - Receiving application successfully processed message
	// AE - Receiving application found error in processing message. Sending error response with additional error detail information
	// AR - Receiving application failed to process message for reason unrelated to content or format
	ack = xml.*::acknowledgement.*::typeCode.@code.toString();
	channelMap.put('ACK', ack.toString());

<<<<<<< Updated upstream
		xml = xml.*::Body.*::PRPA_IN201306UV02;

		// Acknowledgement code as described in HL7 message processing rules
		// AA - Receiving application successfully processed message
		// AE - Receiving application found error in processing message. Sending error response with additional error detail information
		// AR - Receiving application failed to process message for reason unrelated to content or format
		ack = xml.*::acknowledgement.*::typeCode.@code.toString();
		channelMap.put('ACK', ack.toString());

		// The result status of the query
		// OK - Query reponse data found for 1 or more result sets matching the query request specification
		// NF - No errors, but no data was found matching the query request specification
		// AE - Query or application error
		// QE - Problem with input Parmeters error
		queryResponseCode = xml.*::controlActProcess.*::queryAck.*::queryResponseCode.@code.toString();
		channelMap.put('QACK', queryResponseCode.toString());
	}
=======
	// The result status of the query
	// OK - Query reponse data found for 1 or more result sets matching the query request specification
	// NF - No errors, but no data was found matching the query request specification
	// AE - Query or application error
	// QE - Problem with input Parmeters error
	queryResponseCode = xml.*::controlActProcess.*::queryAck.*::queryResponseCode.@code.toString();
	channelMap.put('QACK', queryResponseCode.toString());
	
>>>>>>> Stashed changes
	
} catch(ex) {
	if (globalMap.containsKey('TEST_MODE')) logger.error('XCPD ITI-55 Processor: Response - ' + ex);
	channelMap.put('RESPONSE_ERROR', ex.toString());
	throw ex;
}
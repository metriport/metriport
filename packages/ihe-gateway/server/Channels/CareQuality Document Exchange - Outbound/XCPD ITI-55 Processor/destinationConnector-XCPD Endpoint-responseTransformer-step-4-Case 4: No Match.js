// Case 4: The Responding Gateway finds no patients anywhere close to matching the criteria sent in the query parameters.
// AA (application accept) is returned in Acknowledgement.typeCode (transmission wrapper).
// NF (data found, no errors) is returned in QueryAck.queryResponseCode (control act wrapper)
// There is no RegistrationEvent returned in the response.

var requestId = channelMap.get('MSG_ID');
var cxId = channelMap.get('CUSTOMER_ID');

var baseLogMessage = "XCPD ITI55 Processor: Response (Case4) - requestId: " + requestId.toString() + ", " + "cxId: " + cxId.toString() + " - ";


if ('AA' == ack.toString() && 'NF' == queryResponseCode.toString()) try {

	var operationOutcome = getOperationOutcome(channelMap.get('MSG_ID'));
	var issue = {
				 "severity": "information",
				 "code": "not-found",
				 "details": {"text": "NF"}
			};
	operationOutcome.issue.push(issue);
	channelMap.put('RESULT', 'NO MATCH');

	var _response = getXCPD55ResponseTemplate(channelMap.get('REQUEST'), operationOutcome);

  logger.info(baseLogMessage + 'Response: ' + JSON.stringify(_response));

	// Send the response back to the app
	var result = router.routeMessageByChannelId(globalMap.get('XCPDAPPINTERFACE'), JSON.stringify(_response));

	// Stop further processing
	return;
	
} catch(ex) {
  logger.error(baseLogMessage + 'Error: ' + ex);
	channelMap.put('RESPONSE_ERROR', ex.toString());	
	throw ex;
}
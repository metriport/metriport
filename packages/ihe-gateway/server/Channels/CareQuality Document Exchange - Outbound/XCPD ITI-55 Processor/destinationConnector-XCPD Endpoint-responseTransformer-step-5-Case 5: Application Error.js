// Case 5: The Responding Gateway is unable to satisfy the request. 
// This may be because the request came synchronously and an asynchronous request may be feasible, or because the Responding Gateway is overloaded 
// with other requests and does not expect to answer for a significant period of time. 
// It may also be that the Responding Gateway may need some manual configuration update to authorize responder or another error occurred while 
// the Responding Gateway was processing the message payload.
// AE (application error) is returned in Acknowledgement.typeCode (transmission wrapper).
// AE (application error) is returned in QueryAck.queryResponseCode (control act wrapper)
// There is no RegistrationEvent returned in the response.

if (['AE','AR'].indexOf(ack.toString()) > -1 || ['AE','QE'].indexOf(queryResponseCode.toString()) > -1) try {

	var operationOutcome = getOperationOutcome(channelMap.get('MSG_ID'));

	try {
		var issue = {
					 "severity": "error",
					 "code": "structure",
					 "details": {"text": ""}
				};
		issue.code = xml.*::['acknowledgement'].*::['acknowledgementDetail'].*::['code']['@code'].toString();
		issue.details.text = xml.*::['acknowledgement'].*::['acknowledgementDetail'].*::['text'].toString();
		operationOutcome.issue.push(issue);
	} catch(e) {}
	
	for each (var trigger in xml.*::['controlActProcess'].*::['reasonOf'].*::['detectedIssueEvent'].*::['triggerFor']) {
		

		var reason = trigger.*::['actOrderRequired'].*::['code']['@code'].toString();
		var issue = {
					 "severity": "warning",
					 "code": "invalid",
					 "details": {"text": ""}
				};
		issue.details.text = reason;
		operationOutcome.issue.push(issue);		
	}
  channelMap.put('OPERATION_OUTCOME', JSON.stringify(operationOutcome));
	var _response = getXCPD55ResponseTemplate(channelMap.get('REQUEST'), operationOutcome);
	
	// Send the response back to the app
	var result = router.routeMessageByChannelId(globalMap.get('XCPDAPPINTERFACE'), JSON.stringify(_response));

	// Stop further processing
	return;
	
} catch(ex) {
	if (globalMap.containsKey('TEST_MODE')) logger.error('XCPD ITI-55 Processor: Response (Case5) - ' + ex);
	channelMap.put('RESPONSE_ERROR', ex.toString());	
	throw ex;
}
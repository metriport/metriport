// This script executes once after a message has been processed
// Responses returned from here will be stored as "Postprocessor" in the response map

var dest = responseMap.get(channelMap.get('DEST_ID'));

if (dest && 'ERROR' == dest.getStatus()) try {

	// Generate response to be sent to the app
	var operationOutcome = getOperationOutcome(channelMap.get('MSG_ID'));
	var issue = {
				 "severity": "fatal",
				 "code": "invalid",
				 "details": {"text": ""}
			};
	issue.details.text = dest.getStatusMessage();
	operationOutcome.issue.push(issue);

	var _response = getXCA38ResponseTemplate(channelMap.get('REQUEST'), operationOutcome);
	
	// Send the response back to the app
	var result = router.routeMessageByChannelId(globalMap.get('XCADQAPPINTERFACE'), JSON.stringify(_response));

} catch(ex) {
	if (globalMap.containsKey('TEST_MODE')) logger.error('XCA ITI-38 Processor: Postprocessor - ' + ex);
	throw ex;
}

return;
// This transaction may return both errors and results in an AdhocQueryResponse message.
// The RegistryErrorList element may be present. 
// If present will contain one or more RegistryError elements with warning severity; none with error severity

var requestId = channelMap.get('MSG_ID');
var cxId = channelMap.get('CUSTOMER_ID');

var baseLogMessage = "XCA ITI38 Processor: Response (Case1) - requestId: " + requestId.toString() + ", " + "cxId: " + cxId.toString() + " - ";

if ('Success' == queryResponseCode.toString() || 'PartialSuccess' == queryResponseCode.toString()) {

	var _response = getXCA38ResponseTemplate(channelMap.get('REQUEST'), null);

	// Process RegistryObjectList
	if (xml.*::RegistryObjectList.length() > 0) {	
		var contentList = processRegistryObjectList(xml.*::RegistryObjectList);
		if (contentList) {
			_response.documentReference = contentList;
			channelMap.put('RESULT', contentList.length + ' doc(s)');
		}		
	}

	// Process possible RegistryError entries
	if (xml.*::RegistryErrorList.length() > 0) {
		var operationOutcome = processRegistryErrorList(xml.*::RegistryErrorList);
		if (operationOutcome) _response.operationOutcome = operationOutcome;
	}
  
  logger.info(baseLogMessage + 'Response: ' + JSON.stringify(_response));

	var result = router.routeMessageByChannelId(globalMap.get('XCADQAPPINTERFACE'), JSON.stringify(_response));

	// Stop further processing
	return;
}
// If the transaction resulted in warnings or errors, the RegistryResponse.RegistryErrorList
// shall contain corresponding RegistryError elements.
// At least one has error severity; others may have warning severity.

if ('Failure' == queryResponseCode.toString()) {

	if (xml.*::RegistryResponse.*::RegistryErrorList.length() > 0) try {	

		var operationOutcome = processRegistryErrorList(xml.*::RegistryResponse.*::RegistryErrorList);
		if (operationOutcome) {
			channelMap.put('RESULT', operationOutcome.issue.length + ' issue(s)');
			var _response = getXCA39ResponseTemplate(channelMap.get('REQUEST'), operationOutcome);
			var result = router.routeMessageByChannelId(globalMap.get('XCADRAPPINTERFACE'), JSON.stringify(_response));
		}
		
	} catch(ex) {
		if (globalMap.containsKey('TEST_MODE')) logger.error('XCA ITI-39 Processor: Response (Case2) - ' + ex);
		throw ex;
	}

	// Stop further processing
	return;	
}
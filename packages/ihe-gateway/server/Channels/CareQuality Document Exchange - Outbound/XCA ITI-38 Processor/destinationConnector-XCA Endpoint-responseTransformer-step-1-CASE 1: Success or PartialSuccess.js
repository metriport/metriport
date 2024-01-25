// This transaction may return both errors and results in an AdhocQueryResponse message.
// The RegistryErrorList element may be present. 
// If present will contain one or more RegistryError elements with warning severity; none with error severity

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

	var result = router.routeMessageByChannelId(globalMap.get('XCAAPPINTERFACE'), JSON.stringify(_response));

	// Stop further processing
	return;
}
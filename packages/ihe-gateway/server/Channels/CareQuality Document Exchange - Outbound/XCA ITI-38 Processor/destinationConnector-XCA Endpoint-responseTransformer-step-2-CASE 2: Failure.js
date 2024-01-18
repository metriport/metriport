// If the transaction resulted in warnings or errors, the RegistryResponse or AdhocQueryResponse shall contain an RegistryErrorList,
// which shall contain corresponding RegistryError elements.
// At least one has error severity; others may have warning severity.

if ('Failure' == queryResponseCode.toString()) {

	if (xml.*::RegistryErrorList.length() > 0) {	

		var operationOutcome = processRegistryErrorList(xml.*::RegistryErrorList);		
		if (operationOutcome) {
			var _response = getXCA38ResponseTemplate(channelMap.get('REQUEST'), operationOutcome);
			var result = router.routeMessageByChannelId(globalMap.get('XCAAPPINTERFACE'), JSON.stringify(_response));
		}
	}

	// Stop further processing
	return;	
}
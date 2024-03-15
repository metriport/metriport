// If the transaction resulted in warnings or errors, the RegistryResponse or AdhocQueryResponse shall contain an RegistryErrorList,
// which shall contain corresponding RegistryError elements.
// At least one has error severity; others may have warning severity.

var requestId = channelMap.get('MSG_ID');
var cxId = channelMap.get('CUSTOMER_ID');

var baseLogMessage = "XCA DQ ITI-38 Processor: Response (Case2) - requestId: " + requestId.toString() + ", " + "cxId: " + cxId.toString() + " - ";

if ('Failure' == queryResponseCode.toString()) {

	if (xml.*::RegistryErrorList.length() > 0) {

		var operationOutcome = processRegistryErrorList(xml.*::RegistryErrorList);
		if (operationOutcome) {
			var _response = getXCA38ResponseTemplate(channelMap.get('REQUEST'), operationOutcome);
      logger.info(baseLogMessage + 'Response: ' + JSON.stringify(_response));
			var result = router.routeMessageByChannelId(globalMap.get('XCADQAPPINTERFACE'), JSON.stringify(_response));
		}
	}

	// Stop further processing
	return;
}
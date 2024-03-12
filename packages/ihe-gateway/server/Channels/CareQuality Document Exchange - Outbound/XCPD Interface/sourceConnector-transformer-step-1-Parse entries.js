var xcpdArray = json.gateways;
delete json.xcpdGateways;

var errorCount = 0;

var baseLogMessage = "XCPD Interface: Transformer (Step1) - requestId: " + json.id.toString() + ", " + "cxId: " + json.cxId.toString() + " - ";

// Generate XCPD ITI-55 Processor feed for each entry
xcpdArray.forEach(function(entry) { 
	
	try {

		var jsonXCPD = json;
		jsonXCPD.gateway = {};
		jsonXCPD.gateway.id = entry.id.toString();

		if (entry.hasOwnProperty('oid') && isNotEmpty(entry.oid)) {
			jsonXCPD.gateway.oid = entry.oid.toString();
		} else {
			errorCount++;
		}

		if (entry.hasOwnProperty('url') && isNotEmpty(entry.url)) {
			jsonXCPD.gateway.url = entry.url.toString();
		} else {
			errorCount++;
		}

		delete jsonXCPD.gateways;
		
    if (0 == errorCount) {
      logger.info(baseLogMessage + 'gateway: ' + JSON.stringify(jsonXCPD));
      var result = router.routeMessageByChannelId($g("ITI55PROCESSOR"), JSON.stringify(jsonXCPD));
    } else {
      channelMap.put(
        "NOTE",
        "ERROR - " + errorCount.toString() + " error(s) is/are found in the entries"
      );
    }
  } catch (ex) {
    logger.error(baseLogMessage + 'error: ' + ex);
  }
});

// Destination is not needed
destinationSet.removeAll();
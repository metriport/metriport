var	totalCount = 0, 
	processedCount = 0;

// Loop through all request entries
if (json) {
	json.forEach(function(entry) {	

		totalCount++;
		var errorCount = 0;

		// Check for required parameters
		try {
			
			if (!entry.hasOwnProperty('gateways') || 0 == entry.gateways.toString().length) {
				errorCount++;
			} else if (!entry.hasOwnProperty('patientResource')) {
				errorCount++;
			}
			
		} catch(ex) {
			if (globalMap.containsKey('TEST_MODE')) logger.error('XCPD Bulk Interface: Source - ' + ex);
			errorCount++;
		}
	
		// Pass to the XCPD Interface channel to process
		if (0 == errorCount) {			
			var result = router.routeMessageByChannelId($g('XCPDINTERFACE'), JSON.stringify(entry));			
		} else {
			channelMap.put("responseCode", "400");
			channelMap.put('NOTE', 'ERROR - ' + errorCount.toString() + ' error(s) is/are found in the entries');
		}
	});
}

// Store for stat
channelMap.put('TCOUNT', totalCount.toString());
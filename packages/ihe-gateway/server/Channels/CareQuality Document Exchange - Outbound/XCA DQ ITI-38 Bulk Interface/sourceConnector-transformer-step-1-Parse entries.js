var	totalCount = 0;

// Loop through all request entries
if (json) {
	json.forEach(function(entry) {

		totalCount++;
		var errorCount = 0;

		// Check for required parameters
		try {
			
			if (!entry.hasOwnProperty('gateway')) {
				errorCount++;
			} else if (!entry.hasOwnProperty('externalGatewayPatient')) {
				errorCount++;
			} else if (!entry.gateway.hasOwnProperty('homeCommunityId') || 0 == entry.gateway.homeCommunityId.toString().length ||
					!entry.gateway.hasOwnProperty('url') || 0 == entry.gateway.url.toString().length) {
				errorCount++;
			}

		} catch(ex) {
			if (globalMap.containsKey('TEST_MODE')) logger.error('XCA ITI-38 Bulk Interface: Source - ' + ex);
			errorCount++;
		}

		// Pass to the XCPD Interface channel to process
		if (0 == errorCount) {

			var result = router.routeMessageByChannelId(globalMap.get('XCAITI38INTERFACE'), JSON.stringify(entry, null, 2));

		} else {
			channelMap.put("responseCode", "400");
			channelMap.put('NOTE', 'ERROR - ' + errorCount.toString() + ' error(s) is/are found in the entries');
		}
	});
}

// Store for stat
channelMap.put('TCOUNT', totalCount.toString());
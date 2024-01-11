var json = null, error = null;


// HTTP 400 Bad Request - by default, the server cannot or will not process the request
channelMap.put("responseCode", "400");


// Decode and parse incoming JSON request if sent over HTTP
if (msg.toString().startsWith('<HttpRequest>')) {
	json = getBase64Content(msg, 'json');
	
} else try {
	
	// Parse JSON request if routed from the XCPD Bulk Interface channel
	json = JSON.parse(msg.toString());
	
} catch(ex) {
	if (globalMap.containsKey('TEST_MODE')) logger.error('XCA ITI-38 Interface: Source - ' + ex);
	error = 'ERROR - ' + ex;
}



// If decoding and parsing the HTTP request fail, it returns an error as a string
if ('string' == typeof json) {
	error = 'ERROR - ' + json;


} else try {	

	// HTTP 202 Accepted - the request is a single entry and has been accepted for further processing
	if (!Array.isArray(json)) {
		
		// Set HTTP response code and processing statistics
		channelMap.put("responseCode", "202");		
		channelMap.put('MSG_ID', json.id.toString());
		channelMap.put('CUSTOMER_ID', json.cxId.toString());
		
	} else {
		error = 'ERROR - Incoming feed is an array of entries';
	}
	
} catch(ex) {
	if (globalMap.containsKey('TEST_MODE')) logger.error('XCA ITI-38 Interface: Source - ' + ex);
	error = 'ERROR - ' + ex;
}


// Cease processing in case of an error
if (error) {
	channelMap.put('NOTE', error);
	throw error;
}
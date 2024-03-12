var json = null, error = null;

// HTTP 400 Bad Request - by default, the server cannot or will not process the request
channelMap.put("responseCode", "400");

var baseLogMessage = "XCA DQ Bulk Interface: Transformer (Step0) - ";

// Destination is not needed
destinationSet.removeAll();


// Decode and parse incoming JSON request
json = getBase64Content(msg, 'json');

logger.info(baseLogMessage + 'response: ' + JSON.stringify(json));

// Validate request
if ('string' == typeof json) {
	error = 'ERROR - ' + json;
} else {	

	// HTTP 202 Accepted - the request is an array of entries and has been accepted for further processing
	if (Array.isArray(json)) { 
		channelMap.put("responseCode", "202");
	} else {		
		error = 'ERROR - Incoming feed is not an array of entries';
	}
}


// Cease processing in case of an error
if (error) {
	channelMap.put('NOTE', error);
  logger.error(baseLogMessage + 'err: ' + error);
	throw error;
}